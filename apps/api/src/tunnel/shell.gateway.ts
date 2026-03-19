import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { TunnelService } from './tunnel.service';
import { EnvSharesService } from '../env-shares/env-shares.service';
import { SecureLogger } from '../common/security';

interface ShellSession {
  connectionId: string;
  code: string;
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

@WebSocketGateway({
  namespace: '/shell',
  cors: { origin: '*' },
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
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Shell client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const session = this.socketToSession.get(client.id);
    if (!session) return;

    this.socketToSession.delete(client.id);

    if (session.shared) {
      const shared = this.sharedSessions.get(session.code);
      if (shared) {
        shared.proxy.removeClient(client.id);
        this.broadcastParticipants(shared);
        this.logger.log(`Shell client ${client.id} left shared session for ${session.code} (${shared.proxy.clientCount} remaining)`);
        if (shared.proxy.clientCount === 0) {
          this.tunnelService.handleReachCloseFromBrowser(shared.connectionId);
          this.sharedSessions.delete(session.code);
          this.logger.log(`Shared session for ${session.code} closed (no clients left)`);
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
    @MessageBody() data: { code?: string; shared?: boolean },
  ) {
    const code = data?.code?.trim();
    if (!code) {
      client.emit('auth_error', { message: 'Share code is required' });
      client.disconnect();
      return;
    }

    const shared = data?.shared === true;

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

    // Default: private session (one PTY per browser)
    const connectionId = `browser-${randomUUID()}`;
    try {
      await this.tunnelService.createBrowserBridge(connectionId, service.id, client);
      this.socketToSession.set(client.id, { connectionId, code });
      client.emit('auth_ok', { connectionId });
      this.logger.log(`Shell bridge ${connectionId} created for share ${code}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create shell connection';
      client.emit('auth_error', { message });
      client.disconnect();
    }
  }

  private async handleSharedAuth(client: Socket, code: string, serviceId: string) {
    const existing = this.sharedSessions.get(code);

    if (existing) {
      existing.proxy.addClient(client.id, client);
      this.socketToSession.set(client.id, {
        connectionId: existing.connectionId,
        code,
        shared: true,
      });
      client.emit('auth_ok', { connectionId: existing.connectionId, shared: true });
      existing.proxy.replayTo(client);
      this.broadcastParticipants(existing);
      this.logger.log(`Shell client ${client.id} joined shared session for ${code} (${existing.proxy.clientCount} clients)`);
      return;
    }

    // First joiner — create the shared session
    const connectionId = `shared-${randomUUID()}`;
    const proxy = new BroadcastSocket();
    proxy.addClient(client.id, client);

    const entry: SharedSessionEntry = { connectionId, code, serviceId, proxy };
    this.sharedSessions.set(code, entry);
    this.socketToSession.set(client.id, { connectionId, code, shared: true });

    try {
      await this.tunnelService.createBrowserBridge(connectionId, serviceId, proxy as any);
      client.emit('auth_ok', { connectionId, shared: true });
      this.broadcastParticipants(entry);
      this.logger.log(`Shared session ${connectionId} created for share ${code}`);
    } catch (err) {
      this.sharedSessions.delete(code);
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
      const shared = this.sharedSessions.get(session.code);
      if (shared) {
        shared.proxy.removeClient(client.id);
        this.broadcastParticipants(shared);
        if (shared.proxy.clientCount === 0) {
          this.tunnelService.handleReachCloseFromBrowser(shared.connectionId);
          this.sharedSessions.delete(session.code);
        }
      }
    } else {
      this.tunnelService.handleReachCloseFromBrowser(session.connectionId);
    }
    this.socketToSession.delete(client.id);
  }
}
