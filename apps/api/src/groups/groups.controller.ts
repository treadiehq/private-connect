import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { SharesService } from '../shares/shares.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { z } from 'zod';

const SERVICE_NAME = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, hyphens, and underscores');

const GROUP_NAME = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, hyphens, and underscores');

const InlineServiceSchema = z.object({
  agentId: z.string().uuid(),
  name: SERVICE_NAME,
  targetHost: z.string().min(1).max(253),
  targetPort: z.number().int().min(1).max(65535),
  protocol: z.enum(['auto', 'tcp', 'udp', 'http', 'https']).optional(),
  isPublic: z.boolean().optional(),
});

const CreateGroupSchema = z.object({
  name: GROUP_NAME,
  metadata: z.record(z.unknown()).optional(),
  services: z.array(InlineServiceSchema).max(20).optional(),
});

const CreateGroupShareSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never']).optional(),
});

@ApiTags('Groups')
@Controller('v1/groups')
export class GroupsController {
  constructor(
    private groupsService: GroupsService,
    private sharesService: SharesService,
  ) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create service group',
    description: 'Create a named group of services. Optionally include inline services to register them in one call.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'fix-auth-bug' },
        metadata: { type: 'object', example: { branch: 'fix-auth-bug', repo: 'acme/app' } },
        services: {
          type: 'array',
          items: {
            type: 'object',
            required: ['agentId', 'name', 'targetHost', 'targetPort'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'app' },
              targetHost: { type: 'string', example: 'localhost' },
              targetPort: { type: 'number', example: 3000 },
              protocol: { type: 'string', enum: ['auto', 'tcp', 'udp', 'http', 'https'] },
              isPublic: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Group created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Group name already exists' })
  async createGroup(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const group = await this.groupsService.create({
      workspaceId: req.workspace.id,
      ...parsed.data,
    });

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        metadata: group.metadata ? JSON.parse(group.metadata) : null,
        createdAt: group.createdAt,
        services: group.services.map((s: any) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          protocol: s.protocol,
        })),
      },
    };
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'List service groups', description: 'List all service groups in the workspace.' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async listGroups(@Req() req: any) {
    const groups = await this.groupsService.list(req.workspace.id);

    return {
      success: true,
      groups: groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        metadata: g.metadata ? JSON.parse(g.metadata) : null,
        createdAt: g.createdAt,
        serviceCount: g._count.services,
        services: g.services,
      })),
    };
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get service group', description: 'Get a service group with its services.' })
  @ApiResponse({ status: 200, description: 'Group details' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async getGroup(@Param('id') id: string, @Req() req: any) {
    const group = await this.groupsService.get(id, req.workspace.id);

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        metadata: group.metadata ? JSON.parse(group.metadata) : null,
        createdAt: group.createdAt,
        services: group.services,
      },
    };
  }

  @Post(':id/services')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Add service to group', description: 'Register a new service in an existing group.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'name', 'targetHost', 'targetPort'],
      properties: {
        agentId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'logs' },
        targetHost: { type: 'string', example: 'localhost' },
        targetPort: { type: 'number', example: 9200 },
        protocol: { type: 'string', enum: ['auto', 'tcp', 'udp', 'http', 'https'] },
        isPublic: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Service added to group' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async addService(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = InlineServiceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const service = await this.groupsService.addService(id, req.workspace.id, parsed.data);

    return {
      success: true,
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
        protocol: service.protocol,
      },
    };
  }

  @Post(':id/shares')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Share group services',
    description: 'Create share links for all services in a group.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'preview-for-alice' },
        description: { type: 'string' },
        expiresIn: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'never'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Shares created for group services' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async createGroupShares(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = CreateGroupShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const group = await this.groupsService.get(id, req.workspace.id);

    if (group.services.length === 0) {
      throw new HttpException('Group has no services', HttpStatus.BAD_REQUEST);
    }

    let expiresAt: Date | undefined;
    if (parsed.data.expiresIn && parsed.data.expiresIn !== 'never') {
      const durations: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      expiresAt = new Date(Date.now() + durations[parsed.data.expiresIn]);
    }

    const linkBaseUrl = process.env.LINK_BASE_URL || '';
    const shares = [];

    for (const svc of group.services) {
      const share = await this.sharesService.createShare({
        serviceId: svc.id,
        name: `${parsed.data.name} — ${svc.name}`,
        description: parsed.data.description,
        expiresAt,
        createdBy: req.apiKeyId ? `apikey:${req.apiKeyId}` : undefined,
      });

      shares.push({
        id: share.id,
        token: share.token,
        serviceName: svc.name,
        shareUrl: `${linkBaseUrl}/shared/${share.token}`,
        expiresAt: share.expiresAt,
      });
    }

    return { success: true, groupId: id, shares };
  }

  @Delete(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Delete service group',
    description: 'Delete a group and all its services. Grants and shares on those services are cascade-deleted.',
  })
  @ApiResponse({ status: 200, description: 'Group deleted' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async deleteGroup(@Param('id') id: string, @Req() req: any) {
    const result = await this.groupsService.delete(id, req.workspace.id);
    return { success: true, deletedServices: result.deletedServices };
  }
}
