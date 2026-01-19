import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHmac } from 'crypto';

export type WebhookEventType =
  | 'tunnel.created'
  | 'tunnel.connected'
  | 'tunnel.disconnected'
  | 'tunnel.deleted'
  | 'share.created'
  | 'share.accessed'
  | 'share.revoked'
  | 'agent.connected'
  | 'agent.disconnected'
  | 'agent.registered';

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

export interface CreateWebhookDto {
  url: string;
  events: WebhookEventType[];
  description?: string;
}

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new webhook
   */
  async create(workspaceId: string, dto: CreateWebhookDto) {
    // Validate URL
    try {
      new URL(dto.url);
    } catch {
      throw new HttpException('Invalid URL', HttpStatus.BAD_REQUEST);
    }

    // Require HTTPS in production
    if (process.env.NODE_ENV === 'production' && !dto.url.startsWith('https://')) {
      throw new HttpException('Webhook URL must use HTTPS', HttpStatus.BAD_REQUEST);
    }

    // Generate secret
    const secret = randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        workspaceId,
        url: dto.url,
        secret,
        events: dto.events,
        description: dto.description,
      },
    });

    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret, // Only returned on creation!
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    };
  }

  /**
   * List webhooks for a workspace
   */
  async list(workspaceId: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      description: w.description,
      isActive: w.isActive,
      lastCalledAt: w.lastCalledAt,
      lastStatusCode: w.lastStatusCode,
      consecutiveFailures: w.consecutiveFailures,
      createdAt: w.createdAt,
    }));
  }

  /**
   * Get a single webhook
   */
  async findById(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
      include: {
        deliveries: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!webhook) return null;

    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      lastCalledAt: webhook.lastCalledAt,
      lastStatusCode: webhook.lastStatusCode,
      consecutiveFailures: webhook.consecutiveFailures,
      createdAt: webhook.createdAt,
      recentDeliveries: webhook.deliveries.map((d) => ({
        id: d.id,
        eventType: d.eventType,
        status: d.status,
        statusCode: d.statusCode,
        attemptedAt: d.attemptedAt,
        retryCount: d.retryCount,
      })),
    };
  }

  /**
   * Update a webhook
   */
  async update(
    id: string,
    workspaceId: string,
    data: { url?: string; events?: WebhookEventType[]; description?: string; isActive?: boolean },
  ) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
    });

    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    if (data.url) {
      try {
        new URL(data.url);
      } catch {
        throw new HttpException('Invalid URL', HttpStatus.BAD_REQUEST);
      }
    }

    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        url: data.url,
        events: data.events,
        description: data.description,
        isActive: data.isActive,
      },
    });

    return {
      id: updated.id,
      url: updated.url,
      events: updated.events,
      description: updated.description,
      isActive: updated.isActive,
    };
  }

  /**
   * Delete a webhook
   */
  async delete(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
    });

    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.webhook.delete({ where: { id } });
  }

  /**
   * Rotate webhook secret
   */
  async rotateSecret(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
    });

    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    const newSecret = randomBytes(32).toString('hex');

    await this.prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });

    return { secret: newSecret };
  }

  /**
   * Emit an event to all subscribed webhooks
   */
  async emit(workspaceId: string, event: WebhookEventType, data: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: event },
      },
    });

    const payload: WebhookPayload = {
      id: randomBytes(16).toString('hex'),
      event,
      timestamp: new Date().toISOString(),
      workspaceId,
      data,
    };

    // Create delivery records and dispatch
    const deliveries = await Promise.all(
      webhooks.map(async (webhook) => {
        const delivery = await this.prisma.webhookDelivery.create({
          data: {
            webhookId: webhook.id,
            eventType: event,
            payload: JSON.stringify(payload),
            status: 'pending',
          },
        });

        // Dispatch asynchronously (don't await)
        this.deliver(webhook, delivery.id, payload).catch((err) => {
          console.error(`Webhook delivery failed for ${webhook.id}:`, err);
        });

        return delivery;
      }),
    );

    return {
      event,
      webhooksTriggered: webhooks.length,
      deliveryIds: deliveries.map((d) => d.id),
    };
  }

  /**
   * Deliver a webhook payload
   */
  private async deliver(
    webhook: { id: string; url: string; secret: string },
    deliveryId: string,
    payload: WebhookPayload,
  ) {
    const body = JSON.stringify(payload);
    const signature = this.sign(body, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Id': payload.id,
        },
        body,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const statusCode = response.status;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.prisma.$transaction([
          this.prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'success',
              statusCode,
              response: responseBody.slice(0, 1000),
              attemptedAt: new Date(),
              deliveredAt: new Date(),
            },
          }),
          this.prisma.webhook.update({
            where: { id: webhook.id },
            data: {
              lastCalledAt: new Date(),
              lastStatusCode: statusCode,
              consecutiveFailures: 0,
            },
          }),
        ]);
      } else {
        await this.handleFailure(webhook.id, deliveryId, statusCode, responseBody);
      }
    } catch (error: any) {
      await this.handleFailure(webhook.id, deliveryId, null, error.message);
    }
  }

  /**
   * Handle delivery failure
   */
  private async handleFailure(
    webhookId: string,
    deliveryId: string,
    statusCode: number | null,
    error: string,
  ) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) return;

    const retryCount = delivery.retryCount + 1;
    const maxRetries = 5;

    // Exponential backoff: 1min, 5min, 25min, 2hr, 10hr
    const backoffMinutes = Math.pow(5, retryCount - 1);
    const nextRetryAt = retryCount <= maxRetries
      ? new Date(Date.now() + backoffMinutes * 60 * 1000)
      : null;

    await this.prisma.$transaction([
      this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: retryCount > maxRetries ? 'failed' : 'pending',
          statusCode,
          error: error.slice(0, 1000),
          attemptedAt: new Date(),
          retryCount,
          nextRetryAt,
        },
      }),
      this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastCalledAt: new Date(),
          lastStatusCode: statusCode,
          consecutiveFailures: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Sign a payload
   */
  private sign(payload: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * Test a webhook (send test event)
   */
  async test(id: string, workspaceId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id, workspaceId },
    });

    if (!webhook) {
      throw new HttpException('Webhook not found', HttpStatus.NOT_FOUND);
    }

    const payload: WebhookPayload = {
      id: randomBytes(16).toString('hex'),
      event: 'tunnel.created' as WebhookEventType,
      timestamp: new Date().toISOString(),
      workspaceId,
      data: {
        test: true,
        message: 'This is a test webhook event',
      },
    };

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: 'test',
        payload: JSON.stringify(payload),
        status: 'pending',
      },
    });

    // Deliver synchronously for test
    await this.deliver(webhook, delivery.id, payload);

    const result = await this.prisma.webhookDelivery.findUnique({
      where: { id: delivery.id },
    });

    return {
      success: result?.status === 'success',
      statusCode: result?.statusCode,
      error: result?.error,
    };
  }
}
