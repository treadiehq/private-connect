import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('RealtimeGateway');
  private clients = new Map<string, { workspaceId: string }>();

  constructor(private authService: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      // Extract session token from cookies in handshake
      const cookieHeader = client.handshake.headers.cookie;
      const sessionToken = this.extractSessionToken(cookieHeader);

      if (!sessionToken) {
        this.logger.warn(`Client ${client.id} rejected: no session token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Validate session and get workspace
      const session = await this.authService.validateSession(sessionToken);
      if (!session || !session.workspace) {
        this.logger.warn(`Client ${client.id} rejected: invalid session`);
        client.emit('error', { message: 'Invalid or expired session' });
        client.disconnect();
        return;
      }

      const workspaceId = session.workspace.id;

      // Join workspace-specific room for tenant isolation
      const roomName = `workspace:${workspaceId}`;
      client.join(roomName);

      // Track client with workspace info
      this.clients.set(client.id, { workspaceId });

      this.logger.log(
        `Client ${client.id} connected to ${roomName} (total: ${this.clients.size})`,
      );

      // Send initial connection confirmation
      client.emit('connected', { message: 'Connected to realtime updates' });
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}: ${error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    this.clients.delete(client.id);
    this.logger.log(
      `Client ${client.id} disconnected from workspace:${clientInfo?.workspaceId || 'unknown'} (total: ${this.clients.size})`,
    );
  }

  /**
   * Broadcast service update to clients in the service's workspace only
   */
  broadcastServiceUpdate(service: any) {
    if (!service?.workspaceId) {
      this.logger.warn('broadcastServiceUpdate called without workspaceId');
      return;
    }
    const room = `workspace:${service.workspaceId}`;
    this.server?.to(room).emit('service:update', service);
  }

  /**
   * Broadcast diagnostic result to clients in the specified workspace only
   */
  broadcastDiagnosticResult(diagnostic: any, workspaceId: string) {
    if (!workspaceId) {
      this.logger.warn('broadcastDiagnosticResult called without workspaceId');
      return;
    }
    const room = `workspace:${workspaceId}`;
    this.server?.to(room).emit('diagnostic:new', diagnostic);
  }

  /**
   * Broadcast agent status to clients in the specified workspace only
   */
  broadcastAgentStatus(agentId: string, isOnline: boolean, workspaceId: string) {
    if (!workspaceId) {
      this.logger.warn('broadcastAgentStatus called without workspaceId');
      return;
    }
    const room = `workspace:${workspaceId}`;
    this.server?.to(room).emit('agent:status', { agentId, isOnline });
  }

  /**
   * Extract session token from cookie header
   */
  private extractSessionToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies['session'] || null;
  }
}
