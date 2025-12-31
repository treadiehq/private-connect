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
import { TunnelService } from './tunnel.service';
import { AgentsService } from '../agents/agents.service';
import { SecureLogger, extractClientIp, maskIpAddress } from '../common/security';

@WebSocketGateway({
  namespace: '/agent',
  cors: {
    origin: '*',
  },
  pingTimeout: 60000,    // 60 seconds to wait for pong
  pingInterval: 25000,   // Send ping every 25 seconds
})
export class TunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new SecureLogger(TunnelGateway.name);
  private socketToAgent = new Map<string, string>();

  constructor(
    private tunnelService: TunnelService,
    private agentsService: AgentsService,
  ) {}

  /**
   * Extract client IP from Socket.IO handshake
   */
  private getClientIp(client: Socket): string | undefined {
    // Check headers first (for proxied connections)
    const headers = client.handshake.headers as Record<string, string | string[] | undefined>;
    const proxyIp = extractClientIp(headers);
    if (proxyIp) return proxyIp;

    // Fall back to direct connection address
    return client.handshake.address;
  }

  async handleConnection(client: Socket) {
    const agentId = client.handshake.auth?.agentId as string;
    const token = client.handshake.auth?.token as string;
    const clientIp = this.getClientIp(client);
    const userAgent = client.handshake.headers['user-agent'] as string | undefined;

    if (!agentId || !token) {
      this.logger.warn(`Agent connection rejected: missing credentials from ${maskIpAddress(clientIp)}`);
      client.disconnect();
      return;
    }

    // Validate token with full audit logging
    const validation = await this.agentsService.validateTokenWithAudit(
      agentId, 
      token, 
      clientIp,
      userAgent
    );

    if (!validation.valid) {
      if (validation.expired) {
        this.logger.warn(`Agent connection rejected: expired token for ${agentId}`);
        client.emit('error', { 
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired. Please rotate your token.',
        });
      } else {
        this.logger.warn(`Agent connection rejected: invalid token for ${agentId}`);
        client.emit('error', { 
          code: 'INVALID_TOKEN',
          message: 'Invalid credentials',
        });
      }
      client.disconnect();
      return;
    }

    // Warn about expiring token
    if (validation.expiringSoon) {
      this.logger.log(`Agent ${agentId} token expiring soon: ${validation.expiresAt?.toISOString()}`);
      client.emit('token_warning', {
        message: 'Token expiring soon',
        expiresAt: validation.expiresAt?.toISOString(),
      });
    }

    // Log IP change notification (not blocking, just informational)
    if (validation.ipChanged) {
      client.emit('security_notice', {
        type: 'IP_CHANGED',
        message: 'Connection detected from a new IP address',
      });
    }

    this.logger.log(`Agent connected: ${agentId} from ${maskIpAddress(clientIp)}`);
    this.socketToAgent.set(client.id, agentId);
    this.tunnelService.registerAgent(agentId, client);

    // Update last seen with IP
    await this.agentsService.heartbeat(agentId, clientIp);

    client.emit('connected', { 
      message: 'Connected to hub',
      tokenExpiresAt: validation.expiresAt?.toISOString(),
    });
  }

  async handleDisconnect(client: Socket) {
    const agentId = this.socketToAgent.get(client.id);
    if (agentId) {
      this.logger.log(`Agent disconnected: ${agentId}`);
      this.tunnelService.unregisterAgent(agentId);
      this.socketToAgent.delete(client.id);
      
      // Mark agent as offline
      await this.agentsService.setOnlineStatus(agentId, false);
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (agentId) {
      await this.agentsService.heartbeat(agentId);
      return { success: true };
    }
    return { success: false };
  }

  @SubscribeMessage('expose')
  async handleExpose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serviceId: string; serviceName: string; tunnelPort: number; targetHost: string; targetPort: number },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      return { success: false, error: 'Agent not registered' };
    }

    try {
      await this.tunnelService.startTunnelListener(
        agentId,
        data.serviceId,
        data.serviceName,
        data.tunnelPort,
        data.targetHost,
        data.targetPort,
      );
      this.logger.log(`Started tunnel for ${data.serviceName} on port ${data.tunnelPort}`);
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to start tunnel: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('dial_success')
  handleDialSuccess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (agentId) {
      this.tunnelService.handleAgentDialSuccess(data.connectionId, agentId);
    }
  }

  @SubscribeMessage('dial_error')
  handleDialError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; error: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (agentId) {
      this.logger.error(`Agent dial error: ${data.error}`);
      this.tunnelService.handleAgentClose(data.connectionId);
    }
  }

  @SubscribeMessage('data')
  handleData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; data: string },
  ) {
    // Data comes as base64 from agent
    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleAgentData(data.connectionId, buffer);
  }

  @SubscribeMessage('close')
  handleClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    this.tunnelService.handleAgentClose(data.connectionId);
  }

  /**
   * Handle reach_connect: A reaching agent wants to connect to a service
   * exposed by another agent. We bridge the two agents via WebSocket.
   */
  @SubscribeMessage('reach_connect')
  async handleReachConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; serviceId: string },
  ) {
    const reachingAgentId = this.socketToAgent.get(client.id);
    if (!reachingAgentId) {
      return { success: false, error: 'Agent not registered' };
    }

    try {
      await this.tunnelService.createAgentBridge(
        data.connectionId,
        data.serviceId,
        reachingAgentId,
        client,
      );
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Reach connect failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle reach_data: Data from reaching agent to be forwarded to exposing agent
   */
  @SubscribeMessage('reach_data')
  handleReachData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; data: string },
  ) {
    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleReachData(data.connectionId, buffer);
  }

  /**
   * Handle reach_close: Reaching agent is closing the connection
   */
  @SubscribeMessage('reach_close')
  handleReachClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    this.tunnelService.handleReachClose(data.connectionId);
  }
}

