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
  maxHttpBufferSize: 50e6, // 50MB - needed for base64-encoded HTTP responses
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket'],
  allowUpgrades: false,
})
export class TemporaryTunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new SecureLogger(TemporaryTunnelGateway.name);
  private socketToTunnel = new Map<string, string>();

  private extractTunnelIdFromConnectionId(connectionId: string): string | null {
    const parts = connectionId.split('-');
    if (parts.length < 3) {
      return null;
    }
    return parts.slice(0, -2).join('-');
  }

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
  async handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tunnelId: string },
  ) {
    const success = this.tempTunnelService.registerSocket(data.tunnelId, client);
    
    if (success) {
      this.socketToTunnel.set(client.id, data.tunnelId);
      this.logger.log(`Tunnel registered: ${data.tunnelId}`);
      
      // Start TCP server if this is a TCP tunnel
      const tunnel = this.tempTunnelService.getTunnel(data.tunnelId);
      if (tunnel?.type === 'tcp') {
        try {
          await this.tempTunnelService.startTcpServer(data.tunnelId);
          return { success: true, tcpServerStarted: true };
        } catch (err: any) {
          this.logger.error(`Failed to start TCP server: ${err.message}`);
          return { success: true, tcpServerStarted: false, error: err.message };
        }
      }
      
      // Start UDP server if this is a UDP tunnel
      if (tunnel?.type === 'udp') {
        try {
          await this.tempTunnelService.startUdpServer(data.tunnelId);
          return { success: true, udpServerStarted: true };
        } catch (err: any) {
          this.logger.error(`Failed to start UDP server: ${err.message}`);
          return { success: true, udpServerStarted: false, error: err.message };
        }
      }
      
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

  // ─────────────────────────────────────────────────────────────────────────────
  // TCP Tunnel Events
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * CLI confirms TCP dial success
   */
  @SubscribeMessage('tcp_dial_success')
  handleTcpDialSuccess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    const tunnelId = this.extractTunnelIdFromConnectionId(data.connectionId);
    const registeredTunnelId = this.socketToTunnel.get(client.id);

    if (!tunnelId || registeredTunnelId !== tunnelId) {
      this.logger.warn(`Socket ${client.id} attempted TCP dial success for tunnel ${tunnelId || 'unknown'}`);
      return { success: false, error: 'Unauthorized' };
    }

    this.tempTunnelService.handleTcpDialSuccess(data.connectionId);
    return { success: true };
  }

  /**
   * CLI sends TCP data back (response from local service)
   */
  @SubscribeMessage('tcp_data')
  handleTcpData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; data: string },
  ) {
    const tunnelId = this.extractTunnelIdFromConnectionId(data.connectionId);
    const registeredTunnelId = this.socketToTunnel.get(client.id);

    if (!tunnelId || registeredTunnelId !== tunnelId) {
      this.logger.warn(`Socket ${client.id} attempted TCP data for tunnel ${tunnelId || 'unknown'}`);
      return { success: false, error: 'Unauthorized' };
    }

    this.tempTunnelService.handleTcpData(data.connectionId, data.data);
    return { success: true };
  }

  /**
   * CLI signals TCP connection closed
   */
  @SubscribeMessage('tcp_close')
  handleTcpClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    const tunnelId = this.extractTunnelIdFromConnectionId(data.connectionId);
    const registeredTunnelId = this.socketToTunnel.get(client.id);

    if (!tunnelId || registeredTunnelId !== tunnelId) {
      this.logger.warn(`Socket ${client.id} attempted TCP close for tunnel ${tunnelId || 'unknown'}`);
      return { success: false, error: 'Unauthorized' };
    }

    this.tempTunnelService.handleTcpClose(data.connectionId);
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UDP Tunnel Events
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * CLI sends UDP response back (response from local service)
   */
  @SubscribeMessage('udp_response')
  handleUdpResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; data: string },
  ) {
    const tunnelId = this.socketToTunnel.get(client.id);
    if (!tunnelId) {
      this.logger.warn(`Socket ${client.id} sent UDP response without registered tunnel`);
      return { success: false, error: 'Not registered' };
    }

    const buffer = Buffer.from(data.data, 'base64');
    const sent = this.tempTunnelService.sendUdpResponseForSession(tunnelId, data.sessionId, buffer);

    if (!sent) {
      return { success: false, error: 'Unauthorized or unknown session' };
    }

    return { success: true };
  }
}
