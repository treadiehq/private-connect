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
import { SkipThrottle } from '@nestjs/throttler';
import { DebugService } from './debug.service';
import { SecureLogger } from '../common/security';

@SkipThrottle()
@WebSocketGateway({
  namespace: '/debug',
  cors: {
    origin: (process.env.CORS_ORIGINS || 'https://app.privateconnect.co,https://privateconnect.co')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },
})
export class DebugGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new SecureLogger(DebugGateway.name);
  
  // Track subscriptions: socketId -> sessionId
  private subscriptions = new Map<string, string>();
  // Track unsubscribe callbacks
  private unsubscribers = new Map<string, () => void>();
  // Track viewer info: socketId -> { name, joinedAt }
  private viewers = new Map<string, { sessionId: string; name: string; joinedAt: Date }>();

  constructor(private debugService: DebugService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Debug viewer connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Debug viewer disconnected: ${client.id}`);
    
    // Get viewer info before cleanup
    const viewer = this.viewers.get(client.id);
    
    // Clean up subscription
    const unsubscribe = this.unsubscribers.get(client.id);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(client.id);
    }
    this.subscriptions.delete(client.id);
    this.viewers.delete(client.id);

    // Broadcast viewer left
    if (viewer) {
      this.broadcastToSession(viewer.sessionId, 'viewer_left', {
        name: viewer.name,
        viewerCount: this.getViewerCount(viewer.sessionId),
      });
    }
  }

  /**
   * Get count of viewers for a session
   */
  private getViewerCount(sessionId: string): number {
    let count = 0;
    this.viewers.forEach((v) => {
      if (v.sessionId === sessionId) count++;
    });
    return count;
  }

  /**
   * Get list of viewers for a session
   */
  private getViewerList(sessionId: string): Array<{ name: string; joinedAt: Date }> {
    const list: Array<{ name: string; joinedAt: Date }> = [];
    this.viewers.forEach((v) => {
      if (v.sessionId === sessionId) {
        list.push({ name: v.name, joinedAt: v.joinedAt });
      }
    });
    return list;
  }

  /**
   * Subscribe to a debug session by token
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string; name?: string },
  ) {
    const session = await this.debugService.getSessionByToken(data.token);
    
    if (!session) {
      client.emit('error', { message: 'Session not found or expired' });
      return { success: false, error: 'Session not found' };
    }

    if (session.status !== 'active') {
      client.emit('error', { message: 'Session is not active' });
      return { success: false, error: 'Session not active' };
    }

    // Clean up any existing subscription
    const existingUnsubscribe = this.unsubscribers.get(client.id);
    if (existingUnsubscribe) {
      existingUnsubscribe();
      // Remove old viewer entry
      const oldViewer = this.viewers.get(client.id);
      if (oldViewer) {
        this.broadcastToSession(oldViewer.sessionId, 'viewer_left', {
          name: oldViewer.name,
          viewerCount: this.getViewerCount(oldViewer.sessionId) - 1,
        });
      }
    }

    // Generate a viewer name if not provided
    const viewerName = data.name || `Viewer ${client.id.substring(0, 4)}`;

    // Subscribe to packet stream
    const unsubscribe = this.debugService.onPacket(session.id, (packet) => {
      client.emit('packet', packet);
    });

    this.subscriptions.set(client.id, session.id);
    this.unsubscribers.set(client.id, unsubscribe);
    this.viewers.set(client.id, {
      sessionId: session.id,
      name: viewerName,
      joinedAt: new Date(),
    });

    this.logger.log(`Client ${client.id} (${viewerName}) subscribed to session ${session.id}`);

    // Broadcast viewer joined to others
    this.broadcastToSession(session.id, 'viewer_joined', {
      name: viewerName,
      viewerCount: this.getViewerCount(session.id),
      viewers: this.getViewerList(session.id),
    });

    // Send session info including current viewers
    client.emit('session', {
      id: session.id,
      status: session.status,
      aiEnabled: session.aiEnabled,
      packetCount: session.packetCount,
      viewers: this.getViewerList(session.id),
      viewerCount: this.getViewerCount(session.id),
    });

    return { success: true, sessionId: session.id };
  }

  /**
   * Unsubscribe from current session
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket) {
    const unsubscribe = this.unsubscribers.get(client.id);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(client.id);
    }
    this.subscriptions.delete(client.id);

    this.logger.log(`Client ${client.id} unsubscribed`);
    return { success: true };
  }

  /**
   * Request packet history
   */
  @SubscribeMessage('history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number; before?: string },
  ) {
    const sessionId = this.subscriptions.get(client.id);
    if (!sessionId) {
      return { success: false, error: 'Not subscribed to a session' };
    }

    const packets = await this.debugService.getPackets(
      sessionId,
      data.limit || 50,
      data.before,
    );

    return { success: true, packets };
  }

  /**
   * Request full packet details
   */
  @SubscribeMessage('packet_details')
  async handlePacketDetails(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { packetId: string },
  ) {
    const packet = await this.debugService.getPacket(data.packetId);
    if (!packet) {
      return { success: false, error: 'Packet not found' };
    }

    return { success: true, packet };
  }

  /**
   * Broadcast to all viewers of a session
   */
  broadcastToSession(sessionId: string, event: string, data: any) {
    this.subscriptions.forEach((subSessionId, socketId) => {
      if (subSessionId === sessionId) {
        // Use to() to emit to a specific socket by ID
        this.server.to(socketId).emit(event, data);
      }
    });
  }
}
