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
  maxHttpBufferSize: 200e6, // 200MB - large game assets, binary transport
  pingTimeout: 120000,
  pingInterval: 25000,
  transports: ['websocket'],
  allowUpgrades: false,
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

    try {
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

      const clientTypeLabel = validation.clientType ? ` (${validation.clientType})` : '';
      this.logger.log(`Agent connected: ${agentId}${clientTypeLabel} from ${maskIpAddress(clientIp)}`);
      this.socketToAgent.set(client.id, agentId);
      this.tunnelService.registerAgent(agentId, client);

      // Update last seen (non-blocking to avoid delaying the connection)
      this.agentsService.heartbeat(agentId, clientIp).catch((err) => {
        this.logger.warn(`Heartbeat failed for ${agentId}: ${err.message}`);
      });

      client.emit('connected', { 
        message: 'Connected to hub',
        tokenExpiresAt: validation.expiresAt?.toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error handling connection for agent ${agentId}: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const agentId = this.socketToAgent.get(client.id);
    if (agentId) {
      // Check if this socket is still the current one for this agent.
      // If agent reconnected with a new socket, don't mark offline or close tunnels.
      const isCurrentSocket = this.tunnelService.isCurrentSocket(agentId, client.id);
      
      this.socketToAgent.delete(client.id);
      
      if (isCurrentSocket) {
        this.logger.log(`Agent disconnected: ${agentId}`);
        this.tunnelService.unregisterAgent(agentId);
        await this.agentsService.setOnlineStatus(agentId, false);
      } else {
        this.logger.log(`Stale socket disconnected for agent ${agentId}, ignoring (agent reconnected)`);
      }
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
    @MessageBody() data: { serviceId: string; protocol?: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      return { success: false, error: 'Agent not registered' };
    }

    try {
      await this.tunnelService.exposeService(agentId, data.serviceId, data.protocol);
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
      this.tunnelService.handleAgentClose(data.connectionId, agentId);
    }
  }

  @SubscribeMessage('data')
  handleData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string; data: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('Data event from unregistered socket');
      return;
    }

    // Data comes as base64 from agent
    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleAgentData(data.connectionId, buffer, agentId);
  }

  @SubscribeMessage('close')
  handleClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('Close event from unregistered socket');
      return;
    }

    this.tunnelService.handleAgentClose(data.connectionId, agentId);
  }

  @SubscribeMessage('http_response')
  handleHttpResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; status: number; headers: Record<string, string>; body: string | Buffer; bodyEncoding?: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('HTTP response from unregistered socket');
      return;
    }

    this.tunnelService.handleHttpResponse(data.requestId, agentId, data);
  }

  @SubscribeMessage('http_response_start')
  handleHttpResponseStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; status: number; headers: Record<string, string>; totalChunks: number },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) return;
    this.tunnelService.handleHttpResponseStart(data.requestId, agentId, data);
  }

  @SubscribeMessage('http_response_chunk')
  handleHttpResponseChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string; index: number; data: Buffer | string; bodyEncoding?: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) return;
    this.tunnelService.handleHttpResponseChunk(data.requestId, agentId, data);
  }

  @SubscribeMessage('http_response_end')
  handleHttpResponseEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { requestId: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) return;
    this.tunnelService.handleHttpResponseEnd(data.requestId, agentId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UDP Tunnel Events
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle UDP response from agent - forward datagram back to original client
   */
  @SubscribeMessage('udp_response')
  handleUdpResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; serviceId: string; data: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('UDP response from unregistered socket');
      return;
    }

    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleUdpResponse(agentId, data.serviceId, data.sessionId, buffer);
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
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('Reach data event from unregistered socket');
      return;
    }

    const buffer = Buffer.from(data.data, 'base64');
    this.tunnelService.handleReachData(data.connectionId, buffer, agentId);
  }

  /**
   * Handle reach_close: Reaching agent is closing the connection
   */
  @SubscribeMessage('reach_close')
  handleReachClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { connectionId: string },
  ) {
    const agentId = this.socketToAgent.get(client.id);
    if (!agentId) {
      this.logger.warn('Reach close event from unregistered socket');
      return;
    }

    this.tunnelService.handleReachClose(data.connectionId, agentId);
  }
}

