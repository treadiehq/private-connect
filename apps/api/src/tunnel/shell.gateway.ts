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

  constructor(
    private tunnelService: TunnelService,
    private envSharesService: EnvSharesService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Shell client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const session = this.socketToSession.get(client.id);
    if (session) {
      this.tunnelService.handleReachCloseFromBrowser(session.connectionId);
      this.socketToSession.delete(client.id);
      this.logger.log(`Shell client disconnected: ${client.id}, bridge ${session.connectionId} closed`);
    }
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { code?: string },
  ) {
    const code = data?.code?.trim();
    if (!code) {
      client.emit('auth_error', { message: 'Share code is required' });
      client.disconnect();
      return;
    }

    const service = await this.envSharesService.getShellServiceForShare(code);
    if (!service) {
      client.emit('auth_error', {
        message: 'Share not found, expired, or has no shell service. Host must run "connect shell" and include it in the share.',
      });
      client.disconnect();
      return;
    }

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

  @SubscribeMessage('reach_close')
  handleReachClose(@ConnectedSocket() client: Socket, @MessageBody() data: { connectionId?: string }) {
    const session = this.socketToSession.get(client.id);
    if (!session || session.connectionId !== data?.connectionId) {
      return;
    }
    this.tunnelService.handleReachCloseFromBrowser(session.connectionId);
    this.socketToSession.delete(client.id);
  }
}
