import { Controller, Post, Body, Get, Param, Query, Headers, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import { ServicesService } from './services.service';
import { DiagnosticsService } from './diagnostics.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AgentsService } from '../agents/agents.service';
import { SessionsService } from './sessions.service';
import { z } from 'zod';

const RegisterServiceSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  targetHost: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['auto', 'tcp', 'http', 'https']).optional().default('auto'),
  isPublic: z.boolean().optional().default(false),
});

const ReachSchema = z.object({
  sourceAgentId: z.string().uuid(),
  mode: z.enum(['tcp', 'tls', 'http']).optional().default('tcp'),
  timeoutMs: z.number().int().min(1000).max(30000).optional().default(5000),
});

const ExternalServiceSchema = z.object({
  name: z.string().min(1).max(100),
  targetHost: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['auto', 'tcp', 'http', 'https']).optional().default('auto'),
});

@Controller('v1/services')
export class ServicesController {
  constructor(
    private servicesService: ServicesService,
    private diagnosticsService: DiagnosticsService,
    private agentsService: AgentsService,
    private sessionsService: SessionsService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtimeGateway: RealtimeGateway,
  ) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
  ) {
    const parsed = RegisterServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Get workspace from API key
    const workspace = await this.agentsService.validateWorkspaceApiKey(apiKey);
    if (!workspace) {
      throw new HttpException('Invalid or missing API key', HttpStatus.UNAUTHORIZED);
    }

    const { agentId, name, targetHost, targetPort, protocol, isPublic } = parsed.data;
    
    try {
      const service = await this.servicesService.register(
        workspace.id,
        agentId,
        name,
        targetHost,
        targetPort,
        protocol,
        isPublic,
      );
      
      // Notify UI
      this.realtimeGateway.broadcastServiceUpdate(service);
      
      return { 
        success: true, 
        service: {
          id: service.id,
          name: service.name,
          tunnelPort: service.tunnelPort,
          status: service.status,
          protocol: service.protocol,
          isPublic: service.isPublic,
          publicUrl: service.publicSubdomain 
            ? this.servicesService.getPublicUrl(service.publicSubdomain)
            : null,
        }
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const err = error as Error;
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('external')
  async createExternal(
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
  ) {
    const parsed = ExternalServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Get workspace from API key
    const workspace = await this.agentsService.validateWorkspaceApiKey(apiKey);
    if (!workspace) {
      throw new HttpException('Invalid or missing API key', HttpStatus.UNAUTHORIZED);
    }

    const { name, targetHost, targetPort, protocol } = parsed.data;

    try {
      const service = await this.servicesService.registerExternal(
        workspace.id,
        name,
        targetHost,
        targetPort,
        protocol,
      );

      // Notify UI
      this.realtimeGateway.broadcastServiceUpdate(service);

      // Run initial health check automatically (non-blocking)
      this.runInitialHealthCheck(service.id, targetHost, targetPort, protocol);

      return {
        success: true,
        service: {
          id: service.id,
          name: service.name,
          targetHost: service.targetHost,
          targetPort: service.targetPort,
          protocol: service.protocol,
          isExternal: service.isExternal,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const err = error as Error;
      throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Run health check in background (non-blocking)
  private async runInitialHealthCheck(
    serviceId: string,
    targetHost: string,
    targetPort: number,
    protocol: string,
  ) {
    try {
      const result = await this.diagnosticsService.runExternalDiagnostics(
        targetHost,
        targetPort,
        protocol,
      );

      const diagnostic = await this.servicesService.saveDiagnostic(serviceId, result);
      const updatedService = await this.servicesService.findById(serviceId);

      if (updatedService) {
        this.realtimeGateway.broadcastServiceUpdate(updatedService);
        this.realtimeGateway.broadcastDiagnosticResult(diagnostic);
      }
    } catch (error) {
      // Silently fail - this is a background check
      console.error('Initial health check failed:', error);
    }
  }

  @Get()
  async findAll(@Headers('x-api-key') apiKey: string) {
    let workspaceId: string | undefined;
    if (apiKey) {
      const workspace = await this.agentsService.validateWorkspaceApiKey(apiKey);
      if (workspace) {
        workspaceId = workspace.id;
      }
    }
    return this.servicesService.findAll(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }
    return service;
  }

  @Get(':id/diagnostics')
  async getDiagnostics(
    @Param('id') id: string,
    @Query('limit') limit: string = '50',
    @Headers('x-api-key') apiKey: string,
  ) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    let workspaceId: string | undefined;
    if (apiKey) {
      const workspace = await this.agentsService.validateWorkspaceApiKey(apiKey);
      if (workspace) {
        workspaceId = workspace.id;
      }
    }

    return this.servicesService.getDiagnosticHistory(
      id,
      parseInt(limit, 10),
      workspaceId,
    );
  }

  @Post(':id/check')
  async runCheck(@Param('id') id: string) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    let result;

    if (service.isExternal) {
      // External service: run diagnostics directly against target
      result = await this.diagnosticsService.runExternalDiagnostics(
        service.targetHost,
        service.targetPort,
        service.protocol,
      );
    } else {
      // Agent-exposed service: run through tunnel
    if (!service.tunnelPort) {
      throw new HttpException('Tunnel not established', HttpStatus.BAD_REQUEST);
    }

      result = await this.diagnosticsService.runDiagnostics(
      service.tunnelPort,
      service.targetHost,
      service.targetPort,
        service.protocol,
    );
    }

    // Save result (perspective: hub)
    const diagnostic = await this.servicesService.saveDiagnostic(service.id, result);
    
    // Get updated service
    const updatedService = await this.servicesService.findById(id);
    
    // Notify UI
    this.realtimeGateway.broadcastServiceUpdate(updatedService!);
    this.realtimeGateway.broadcastDiagnosticResult(diagnostic);

    return { 
      success: true, 
      diagnostic,
      service: updatedService,
    };
  }

  @Post(':id/reach')
  async runReachCheck(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = ReachSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    const { sourceAgentId, mode, timeoutMs } = parsed.data;

    // Validate source agent
    const sourceAgent = await this.agentsService.findById(sourceAgentId);
    if (!sourceAgent) {
      throw new HttpException('Source agent not found', HttpStatus.NOT_FOUND);
    }

    if (!sourceAgent.isOnline) {
      throw new HttpException('Source agent is offline', HttpStatus.BAD_REQUEST);
    }

    // Create session
    const session = await this.sessionsService.createSession(service.id, sourceAgentId);

    try {
      // For now, run diagnostics from hub but attribute to agent
      // In a full implementation, this would coordinate with the agent
      if (!service.tunnelPort) {
        throw new HttpException('Tunnel not established', HttpStatus.BAD_REQUEST);
      }

      const result = await this.diagnosticsService.runDiagnostics(
        service.tunnelPort,
        service.targetHost,
        service.targetPort,
        service.protocol,
      );

      // Save result with source agent info
      const diagnostic = await this.servicesService.saveDiagnostic(
        service.id,
        result,
        sourceAgentId,
        sourceAgent.label,
      );

      // End session
      await this.sessionsService.endSession(session.id, result.tcpStatus === 'OK' ? 'success' : 'failure');

      // Get updated service
      const updatedService = await this.servicesService.findById(id);

      // Notify UI
      this.realtimeGateway.broadcastServiceUpdate(updatedService!);
      this.realtimeGateway.broadcastDiagnosticResult(diagnostic);

      return {
        success: true,
        diagnostic,
        session: {
          id: session.id,
          outcome: result.tcpStatus === 'OK' ? 'success' : 'failure',
        },
      };
    } catch (error: unknown) {
      await this.sessionsService.endSession(session.id, 'failure');
      throw error;
    }
  }
}
