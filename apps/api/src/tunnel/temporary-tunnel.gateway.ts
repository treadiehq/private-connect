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
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { SecureLogger } from '../common/security';

@WebSocketGateway({
  namespace: '/temp-tunnel',
  cors: {
    origin: '*',
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class TemporaryTunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new SecureLogger(TemporaryTunnelGateway.name);
  private socketToTunnel = new Map<string, string>();

  constructor(private tempTunnelService: TemporaryTunnelService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Temp tunnel client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const tunnelId = this.socketToTunnel.get(client.id);
    if (tunnelId) {
      this.tempTunnelService.unregisterSocket(tunnelId);
      this.socketToTunnel.delete(client.id);
      this.logger.log(`Temp tunnel disconnected: ${tunnelId}`);
    }
  }

  /**
   * CLI registers its tunnel connection
   */
  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tunnelId: string },
  ) {
    const success = this.tempTunnelService.registerSocket(data.tunnelId, client);
    
    if (success) {
      this.socketToTunnel.set(client.id, data.tunnelId);
      this.logger.log(`Tunnel registered: ${data.tunnelId}`);
      return { success: true };
    }
    
    return { success: false, error: 'Tunnel not found or expired' };
  }

  /**
   * CLI sends HTTP response back
   */
  @SubscribeMessage('http_response')
  handleHttpResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      requestId: string; 
      status: number; 
      headers: Record<string, string>; 
      body: string;
    },
  ) {
    // Extract tunnelId from requestId (format: ${tunnelId}-${timestamp}-${random})
    const tunnelId = data.requestId.split('-').slice(0, -2).join('-');
    
    // Verify this socket owns the tunnel
    const registeredTunnelId = this.socketToTunnel.get(client.id);
    if (registeredTunnelId !== tunnelId) {
      this.logger.warn(`Socket ${client.id} attempted to respond to request for tunnel ${tunnelId}`);
      return { success: false, error: 'Unauthorized' };
    }
    
    this.tempTunnelService.handleResponse(data.requestId, {
      status: data.status,
      headers: data.headers,
      body: data.body,
    });
    
    return { success: true };
  }

  /**
   * Heartbeat to keep connection alive
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    return { success: true, timestamp: Date.now() };
  }
}
