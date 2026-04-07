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
import { WebhooksService, WebhookEventType } from './webhooks.service';
import { z } from 'zod';

const VALID_EVENTS: WebhookEventType[] = [
  'tunnel.created',
  'tunnel.connected',
  'tunnel.disconnected',
  'tunnel.deleted',
  'share.created',
  'share.accessed',
  'share.revoked',
  'agent.connected',
  'agent.disconnected',
  'agent.registered',
  'agent.deleted',
  'grant.created',
  'grant.revoked',
];

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS as [WebhookEventType, ...WebhookEventType[]])).min(1),
  description: z.string().max(500).optional(),
});

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(VALID_EVENTS as [WebhookEventType, ...WebhookEventType[]])).min(1).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

@ApiTags('Webhooks')
@Controller('v1/webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create webhook',
    description: 'Creates a new webhook subscription. The secret is only returned on creation.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['url', 'events'],
      properties: {
        url: { type: 'string', format: 'uri', example: 'https://example.com/webhooks' },
        events: {
          type: 'array',
          items: {
            type: 'string',
            enum: VALID_EVENTS,
          },
          example: ['tunnel.created', 'tunnel.deleted'],
        },
        description: { type: 'string', example: 'Production webhook' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook created. Save the secret - it is only shown once.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        events: { type: 'array', items: { type: 'string' } },
        secret: { type: 'string', description: 'HMAC secret for verifying signatures' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async create(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    return this.webhooksService.create(workspace.id, parsed.data);
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'List webhooks',
    description: 'Returns all webhooks for the workspace.',
  })
  @ApiResponse({ status: 200, description: 'List of webhooks' })
  async list(@Req() req: any) {
    const workspace = req.workspace;
    return this.webhooksService.list(workspace.id);
  }

  @Patch(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Update webhook',
    description: 'Updates webhook URL, events, or active status.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        events: { type: 'array', items: { type: 'string', enum: VALID_EVENTS } },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const parsed = UpdateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    return this.webhooksService.update(id, workspace.id, parsed.data);
  }

  @Delete(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Delete webhook',
    description: 'Deletes a webhook and all its delivery history.',
  })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async delete(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    await this.webhooksService.delete(id, workspace.id);
    return { success: true };
  }

  @Post(':id/rotate-secret')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Rotate webhook secret',
    description: 'Generates a new HMAC secret for the webhook.',
  })
  @ApiResponse({
    status: 200,
    description: 'New secret generated',
    schema: {
      type: 'object',
      properties: {
        secret: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async rotateSecret(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    return this.webhooksService.rotateSecret(id, workspace.id);
  }

  @Post(':id/test')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Test webhook',
    description: 'Sends a test event to the webhook endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Test result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        statusCode: { type: 'number' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async test(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    return this.webhooksService.test(id, workspace.id);
  }

  @Get('events')
  @ApiOperation({
    summary: 'List available events',
    description: 'Returns all available webhook event types.',
  })
  @ApiResponse({
    status: 200,
    description: 'Available events',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async listEvents() {
    return {
      events: [
        { name: 'tunnel.created', description: 'A new tunnel was created' },
        { name: 'tunnel.connected', description: 'An agent connected to a tunnel' },
        { name: 'tunnel.disconnected', description: 'An agent disconnected from a tunnel' },
        { name: 'tunnel.deleted', description: 'A tunnel was deleted' },
        { name: 'share.created', description: 'A new share link was created' },
        { name: 'share.accessed', description: 'A share link was accessed' },
        { name: 'share.revoked', description: 'A share link was revoked' },
        { name: 'agent.connected', description: 'An agent came online' },
        { name: 'agent.disconnected', description: 'An agent went offline' },
        { name: 'agent.registered', description: 'A new agent was registered' },
        { name: 'agent.deleted', description: 'An agent was permanently removed' },
      ],
    };
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get webhook',
    description: 'Returns webhook details including recent delivery attempts.',
  })
  @ApiResponse({ status: 200, description: 'Webhook details' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const workspace = req.workspace;
    const webhook = await this.webhooksService.findById(id, workspace.id);
    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }
    return webhook;
  }
}
