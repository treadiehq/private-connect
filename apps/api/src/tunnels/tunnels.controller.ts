import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiSecurity,
} from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { TunnelsService, CreateTunnelDto, UpdateTunnelDto } from './tunnels.service';
import { AuthService } from '../auth/auth.service';
import { z } from 'zod';

const CreateTunnelSchema = z.object({
  target: z.union([
    z.string().regex(/^.+:\d+$/, 'Target must be in host:port format'),
    z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
    }),
  ]),
  name: z.string().min(1).max(100).optional(),
  protocol: z.enum(['auto', 'tcp', 'udp', 'http', 'https']).optional(),
  agentId: z.string().uuid(),
  isPublic: z.boolean().optional(),
});

const UpdateTunnelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'paused']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const CreateShareSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never']).optional(),
  allowedMethods: z.array(z.string()).optional(),
  rateLimitPerMin: z.number().min(1).max(1000).optional(),
});

@ApiTags('Tunnels')
@Controller('v1/tunnels')
export class TunnelsController {
  constructor(
    private tunnelsService: TunnelsService,
    private authService: AuthService,
  ) {}

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'List tunnels',
    description: 'Returns all tunnels (active services with tunnel ports) in the workspace.',
  })
  @ApiResponse({ status: 200, description: 'List of tunnels' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async findAll(@Req() req: any) {
    const workspace = req.workspace;
    return this.tunnelsService.findAll(workspace.id);
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get tunnel',
    description: 'Returns details for a specific tunnel.',
  })
  @ApiResponse({ status: 200, description: 'Tunnel details' })
  @ApiResponse({ status: 404, description: 'Tunnel not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    const tunnel = await this.tunnelsService.findById(id, workspace.id);
    if (!tunnel) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }
    return tunnel;
  }

  @Post()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create tunnel',
    description: 'Creates a new tunnel (equivalent to `connect expose`). Exposes a service through an agent.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['target', 'agentId'],
      properties: {
        target: {
          oneOf: [
            { type: 'string', example: 'localhost:5432' },
            {
              type: 'object',
              properties: {
                host: { type: 'string', example: 'localhost' },
                port: { type: 'number', example: 5432 },
              },
            },
          ],
          description: 'Target service to expose',
        },
        name: { type: 'string', example: 'prod-db', description: 'Optional name (auto-generated if not provided)' },
        protocol: { type: 'string', enum: ['auto', 'tcp', 'udp', 'http', 'https'], default: 'auto' },
        agentId: { type: 'string', format: 'uuid', description: 'Agent that will expose this service' },
        isPublic: { type: 'boolean', default: false, description: 'Make publicly accessible via URL' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tunnel created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async create(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateTunnelSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    return this.tunnelsService.create(workspace.id, parsed.data as CreateTunnelDto);
  }

  @Patch(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Update tunnel',
    description: 'Updates a tunnel (name, status, metadata).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'staging-db' },
        status: { type: 'string', enum: ['active', 'paused'] },
        metadata: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tunnel updated' })
  @ApiResponse({ status: 404, description: 'Tunnel not found' })
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = UpdateTunnelSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    return this.tunnelsService.update(id, workspace.id, parsed.data as UpdateTunnelDto);
  }

  @Delete(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Delete tunnel',
    description: 'Deletes a tunnel (equivalent to revoking/closing the exposed service).',
  })
  @ApiResponse({ status: 200, description: 'Tunnel deleted' })
  @ApiResponse({ status: 404, description: 'Tunnel not found' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    await this.tunnelsService.delete(id, workspace.id);
    return { success: true };
  }

  @Post(':id/share')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create share for tunnel',
    description: 'Creates a shareable link for a tunnel (equivalent to `connect share`).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'contractor-access' },
        description: { type: 'string' },
        expiresIn: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'never'], default: '24h' },
        allowedMethods: { type: 'array', items: { type: 'string' }, example: ['GET', 'POST'] },
        rateLimitPerMin: { type: 'number', minimum: 1, maximum: 1000 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Share created' })
  @ApiResponse({ status: 404, description: 'Tunnel not found' })
  async createShare(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = CreateShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    
    // For API key auth, we need to get the workspace owner as the user
    // In a real scenario, you might want to track who created the share differently
    const workspaceData = await this.authService.getWorkspaceOwner(workspace.id);
    if (!workspaceData) {
      throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
    }

    return this.tunnelsService.createShare(id, workspace.id, workspaceData.ownerId, {
      name: parsed.data.name,
      description: parsed.data.description,
      expiresIn: parsed.data.expiresIn as '1h' | '24h' | '7d' | '30d' | 'never' | undefined,
      allowedMethods: parsed.data.allowedMethods,
      rateLimitPerMin: parsed.data.rateLimitPerMin,
    });
  }

  @Post(':id/connect')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Connect to tunnel',
    description: 'Initiates a connection to a tunnel (equivalent to `connect reach`). Returns connection details.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string', format: 'uuid', description: 'Agent that will receive the tunnel' },
        localPort: { type: 'number', description: 'Local port to bind (optional)' },
      },
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Connection initiated',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        tunnel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            targetHost: { type: 'string' },
            targetPort: { type: 'number' },
            localPort: { type: 'number' },
          },
        },
        connectionString: { type: 'string', example: 'postgres://localhost:5432' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Tunnel not found' })
  async connect(
    @Param('id') id: string,
    @Body() body: { agentId: string; localPort?: number },
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const tunnel = await this.tunnelsService.findById(id, workspace.id);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }

    // In a real implementation, this would:
    // 1. Notify the target agent to establish a reverse tunnel
    // 2. Notify the source agent to connect to the tunnel
    // 3. Return connection details
    
    // For now, return the connection info
    const localPort = body.localPort || tunnel.targetPort;
    const connectionString = this.getConnectionString(tunnel.protocol, localPort, tunnel.targetPort);

    return {
      success: true,
      tunnel: {
        id: tunnel.id,
        name: tunnel.name,
        targetHost: tunnel.targetHost,
        targetPort: tunnel.targetPort,
        localPort,
        tunnelPort: tunnel.tunnelPort,
      },
      connectionString,
      message: tunnel.tunnelPort 
        ? `Tunnel active on port ${tunnel.tunnelPort}`
        : 'Agent connection required',
    };
  }

  /**
   * Generate connection string based on protocol and port
   */
  private getConnectionString(protocol: string, localPort: number, targetPort: number): string {
    const host = 'localhost';
    
    if (targetPort === 5432 || protocol === 'postgres') {
      return `postgres://${host}:${localPort}/postgres`;
    }
    if (targetPort === 3306 || protocol === 'mysql') {
      return `mysql://${host}:${localPort}`;
    }
    if (targetPort === 6379 || protocol === 'redis') {
      return `redis://${host}:${localPort}`;
    }
    if (targetPort === 27017 || protocol === 'mongodb') {
      return `mongodb://${host}:${localPort}`;
    }
    if (protocol === 'http' || protocol === 'https') {
      return `${protocol}://${host}:${localPort}`;
    }
    
    return `tcp://${host}:${localPort}`;
  }
}
