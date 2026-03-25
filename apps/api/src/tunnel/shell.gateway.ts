import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SkipThrottle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { TunnelService } from './tunnel.service';
import { EnvSharesService } from '../env-shares/env-shares.service';
import { SharesService } from '../shares/shares.service';
import { SecureLogger } from '../common/security';

interface ShellSession {
  connectionId: string;
  /** The env-share code or share token used to authenticate */
  credential: string;
  shared?: boolean;
}

const MAX_SCROLLBACK_BYTES = 64 * 1024; // 64 KB

/**
 * Proxy that looks like a Socket to TunnelService but broadcasts
 * events to every browser in a shared session.
 */
class BroadcastSocket {
  private clients = new Map<string, Socket>();
  private scrollback: Array<{ event: string; args: any[] }> = [];
  private scrollbackBytes = 0;

  addClient(id: string, socket: Socket): void {
    this.clients.set(id, socket);
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  replayTo(socket: Socket): void {
    for (const entry of this.scrollback) {
      socket.emit(entry.event, ...entry.args);
    }
  }

  emit(event: string, ...args: any[]): boolean {
    if (event === 'reach_data') {
      const payload = args[0];
      const size = typeof payload?.data === 'string' ? payload.data.length : 0;
      this.scrollback.push({ event, args });
      this.scrollbackBytes += size;
      while (this.scrollbackBytes > MAX_SCROLLBACK_BYTES && this.scrollback.length > 1) {
        const removed = this.scrollback.shift()!;
        const removedSize = typeof removed.args[0]?.data === 'string' ? removed.args[0].data.length : 0;
        this.scrollbackBytes -= removedSize;
      }
    } else if (event === 'reach_ready') {
      this.scrollback.push({ event, args });
    }

    for (const client of this.clients.values()) {
      client.emit(event, ...args);
    }
    return true;
  }
}

interface SharedSessionEntry {
  connectionId: string;
  code: string;
  serviceId: string;
  proxy: BroadcastSocket;
}

@SkipThrottle()
@WebSocketGateway({
  namespace: '/shell',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'https://app.privateconnect.co,https://privateconnect.co')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },
  transports: ['websocket'],
  allowUpgrades: false,
})
export class ShellGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new SecureLogger(ShellGateway.name);
  private socketToSession = new Map<string, ShellSession>();
  private sharedSessions = new Map<string, SharedSessionEntry>();

  constructor(
    private tunnelService: TunnelService,
    private envSharesService: EnvSharesService,
    @Inject(forwardRef(() => SharesService))
    private sharesService: SharesService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Shell client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const session = this.socketToSession.get(client.id);
    if (!session) return;

    this.socketToSession.delete(client.id);

    if (session.shared) {
      const shared = this.sharedSessions.get(session.credential);
      if (shared) {
        shared.proxy.removeClient(client.id);
        this.broadcastParticipants(shared);
        this.logger.log(`Shell client ${client.id} left shared session for ${session.credential} (${shared.proxy.clientCount} remaining)`);
        if (shared.proxy.clientCount === 0) {
          this.tunnelService.handleReachCloseFromBrowser(shared.connectionId);
          this.sharedSessions.delete(session.credential);
          this.logger.log(`Shared session for ${session.credential} closed (no clients left)`);
        }
      }
    } else {
      this.tunnelService.handleReachCloseFromBrowser(session.connectionId);
      this.logger.log(`Shell client disconnected: ${client.id}, bridge ${session.connectionId} closed`);
    }
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code?: string; token?: string; shared?: boolean },
  ) {
    const code = data?.code?.trim();
    const token = data?.token?.trim();

    if (!code && !token) {
      client.emit('auth_error', { message: 'Share code or token is required' });
      client.disconnect();
      return;
    }

    if (token) {
      return this.handleTokenAuth(client, token);
    }

    return this.handleCodeAuth(client, code!, data?.shared === true);
  }

  private async handleCodeAuth(client: Socket, code: string, shared: boolean) {
    const service = await this.envSharesService.getShellServiceForShare(code);
    if (!service) {
      client.emit('auth_error', {
        message: 'Share not found, expired, or has no shell service. Host must run "connect shell" and include it in the share.',
      });
      client.disconnect();
      return;
    }

    if (shared) {
      return this.handleSharedAuth(client, code, service.id);
    }

    const connectionId = `browser-${randomUUID()}`;
    try {
      await this.tunnelService.createBrowserBridge(connectionId, service.id, client);
      this.socketToSession.set(client.id, { connectionId, credential: code });
      client.emit('auth_ok', { connectionId });
      this.logger.log(`Shell bridge ${connectionId} created for share code ${code}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create shell connection';
      client.emit('auth_error', { message });
      client.disconnect();
    }
  }

  private async handleTokenAuth(client: Socket, token: string) {
    const validation = await this.sharesService.validateShare(token);
    if (!validation.valid || !validation.share) {
      client.emit('auth_error', {
        message: validation.reason || 'Share not found or expired',
      });
      client.disconnect();
      return;
    }

    const share = validation.share;
    const service = share.service;

    if (!service || !service.agent) {
      client.emit('auth_error', { message: 'Service not available' });
      client.disconnect();
      return;
    }

    const isShellCapable = service.targetPort === 22 || service.name === 'shell';
    if (!isShellCapable) {
      client.emit('auth_error', {
        message: 'This share does not support terminal access',
      });
      client.disconnect();
      return;
    }

    const connectionId = `browser-token-${randomUUID()}`;
    try {
      await this.tunnelService.createBrowserBridge(connectionId, service.id, client);
      this.socketToSession.set(client.id, { connectionId, credential: token });
      client.emit('auth_ok', { connectionId });
      this.logger.log(`Shell bridge ${connectionId} created for share token`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create shell connection';
      client.emit('auth_error', { message });
      client.disconnect();
    }
  }

  private async handleSharedAuth(client: Socket, credential: string, serviceId: string) {
    const existing = this.sharedSessions.get(credential);

    if (existing) {
      existing.proxy.addClient(client.id, client);
      this.socketToSession.set(client.id, {
        connectionId: existing.connectionId,
        credential,
        shared: true,
      });
      client.emit('auth_ok', { connectionId: existing.connectionId, shared: true });
      existing.proxy.replayTo(client);
      this.broadcastParticipants(existing);
      this.logger.log(`Shell client ${client.id} joined shared session for ${credential} (${existing.proxy.clientCount} clients)`);
      return;
    }

    const connectionId = `shared-${randomUUID()}`;
    const proxy = new BroadcastSocket();
    proxy.addClient(client.id, client);

    const entry: SharedSessionEntry = { connectionId, code: credential, serviceId, proxy };
    this.sharedSessions.set(credential, entry);
    this.socketToSession.set(client.id, { connectionId, credential, shared: true });

    try {
      await this.tunnelService.createBrowserBridge(connectionId, serviceId, proxy as any);
      client.emit('auth_ok', { connectionId, shared: true });
      this.broadcastParticipants(entry);
      this.logger.log(`Shared session ${connectionId} created for ${credential}`);
    } catch (err) {
      this.sharedSessions.delete(credential);
      this.socketToSession.delete(client.id);
      const message = err instanceof Error ? err.message : 'Failed to create shell connection';
      client.emit('auth_error', { message });
      client.disconnect();
    }
  }

  private broadcastParticipants(session: SharedSessionEntry) {
    const count = session.proxy.clientCount;
    session.proxy.emit('session_participants', { count });
  }

  @SubscribeMessage('reach_data')
  handleReachData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId?: string; data?: string },
  ) {
    const session = this.socketToSession.get(client.id);
    if (!session || session.connectionId !== data?.connectionId) {
      return;
    }
    if (typeof data.data !== 'string') {
      return;
    }
    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleReachDataFromBrowser(session.connectionId, buffer);
  }

  @SubscribeMessage('resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId?: string; cols?: number; rows?: number },
  ) {
    const session = this.socketToSession.get(client.id);
    if (!session || session.connectionId !== data?.connectionId) {
      return;
    }
    if (typeof data.cols !== 'number' || typeof data.rows !== 'number') return;
    this.tunnelService.handleResizeFromBrowser(session.connectionId, data.cols, data.rows);
  }

  @SubscribeMessage('reach_close')
  handleReachClose(@ConnectedSocket() client: Socket, @MessageBody() data: { connectionId?: string }) {
    const session = this.socketToSession.get(client.id);
    if (!session || session.connectionId !== data?.connectionId) {
      return;
    }

    if (session.shared) {
      const shared = this.sharedSessions.get(session.credential);
      if (shared) {
        shared.proxy.removeClient(client.id);
        this.broadcastParticipants(shared);
        if (shared.proxy.clientCount === 0) {
          this.tunnelService.handleReachCloseFromBrowser(shared.connectionId);
          this.sharedSessions.delete(session.credential);
        }
      }
    } else {
      this.tunnelService.handleReachCloseFromBrowser(session.connectionId);
    }
    this.socketToSession.delete(client.id);
  }
}
