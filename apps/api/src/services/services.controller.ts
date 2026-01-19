import { Controller, Post, Body, Get, Param, Query, Headers, HttpException, HttpStatus, Inject, forwardRef, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { DiagnosticsService } from './diagnostics.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AgentsService } from '../agents/agents.service';
import { SessionsService } from './sessions.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { z } from 'zod';

const RegisterServiceSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(100),
  targetHost: z.string().min(1).max(253), // Max DNS hostname length
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
  targetHost: z.string().min(1).max(253), // Max DNS hostname length
  targetPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['auto', 'tcp', 'http', 'https']).optional().default('auto'),
});

@ApiTags('Services')
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
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Register service', description: 'Registers a new service exposed by an agent.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'name', 'targetHost', 'targetPort'],
      properties: {
        agentId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'prod-db' },
        targetHost: { type: 'string', example: 'localhost' },
        targetPort: { type: 'number', example: 5432 },
        protocol: { type: 'string', enum: ['auto', 'tcp', 'http', 'https'] },
        isPublic: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Service registered' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async register(
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = RegisterServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
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
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Create external service', description: 'Creates an external service target (not exposed by an agent).' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'targetHost', 'targetPort'],
      properties: {
        name: { type: 'string', example: 'external-api' },
        targetHost: { type: 'string', example: 'api.example.com' },
        targetPort: { type: 'number', example: 443 },
        protocol: { type: 'string', enum: ['auto', 'tcp', 'http', 'https'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'External service created' })
  async createExternal(
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = ExternalServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
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
        this.realtimeGateway.broadcastDiagnosticResult(diagnostic, updatedService.workspaceId);
      }
    } catch (error) {
      // Silently fail - this is a background check
      console.error('Initial health check failed:', error);
    }
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'List services', description: 'Returns all services in the workspace.' })
  @ApiResponse({ status: 200, description: 'List of services' })
  async findAll(@Req() req: any) {
    const workspace = req.workspace;
    return this.servicesService.findAll(workspace.id);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get service', description: 'Returns details for a specific service.' })
  @ApiResponse({ status: 200, description: 'Service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify service belongs to requester's workspace
    const workspace = req.workspace;
    if (service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return service;
  }

  @Get(':id/diagnostics')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get service diagnostics', description: 'Returns diagnostic history for a service.' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of results (default: 50)' })
  @ApiResponse({ status: 200, description: 'Diagnostic history' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getDiagnostics(
    @Param('id') id: string,
    @Query('limit') limit: string = '50',
    @Req() req: any,
  ) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify service belongs to requester's workspace
    const workspace = req.workspace;
    if (service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return this.servicesService.getDiagnosticHistory(
      id,
      parseInt(limit, 10),
      workspace.id,
    );
  }

  @Post(':id/check')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Run service check', description: 'Runs a diagnostic check on the service.' })
  @ApiResponse({ status: 200, description: 'Check completed' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async runCheck(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify service belongs to requester's workspace
    const workspace = req.workspace;
    if (service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
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
    
    // Notify UI (broadcast to workspace-specific room)
    this.realtimeGateway.broadcastServiceUpdate(updatedService!);
    this.realtimeGateway.broadcastDiagnosticResult(diagnostic, service.workspaceId);

    return { 
      success: true, 
      diagnostic,
      service: updatedService,
    };
  }

  @Post(':id/reach')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Reach check', description: 'Tests connectivity to a service from a specific agent.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sourceAgentId'],
      properties: {
        sourceAgentId: { type: 'string', format: 'uuid' },
        mode: { type: 'string', enum: ['tcp', 'tls', 'http'] },
        timeoutMs: { type: 'number', minimum: 1000, maximum: 30000 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Reach check completed' })
  @ApiResponse({ status: 404, description: 'Service or agent not found' })
  async runReachCheck(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = ReachSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const service = await this.servicesService.findById(id);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify service belongs to requester's workspace
    const workspace = req.workspace;
    if (service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
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

      // Notify UI (broadcast to workspace-specific room)
      this.realtimeGateway.broadcastServiceUpdate(updatedService!);
      this.realtimeGateway.broadcastDiagnosticResult(diagnostic, service.workspaceId);

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

  @Delete(':id')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Delete service', description: 'Deletes a service from the workspace.' })
  @ApiResponse({ status: 200, description: 'Service deleted' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async delete(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    
    await this.servicesService.delete(id, workspace.id);
    
    // Notify UI that service was deleted
    this.realtimeGateway.broadcastServiceDelete(id, workspace.id);
    
    return { success: true };
  }
}
