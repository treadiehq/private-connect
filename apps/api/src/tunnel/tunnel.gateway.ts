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
import { Logger } from '@nestjs/common';
import { TunnelService } from './tunnel.service';
import { AgentsService } from '../agents/agents.service';

@WebSocketGateway({
  namespace: '/agent',
  cors: {
    origin: '*',
  },
})
export class TunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TunnelGateway.name);
  private socketToAgent = new Map<string, string>();

  constructor(
    private tunnelService: TunnelService,
    private agentsService: AgentsService,
  ) {}

  async handleConnection(client: Socket) {
    const agentId = client.handshake.auth?.agentId as string;
    const token = client.handshake.auth?.token as string;

    if (!agentId || !token) {
      this.logger.warn(`Agent connection rejected: missing credentials`);
      client.disconnect();
      return;
    }

    // Validate token
    const valid = await this.agentsService.validateToken(agentId, token);
    if (!valid) {
      this.logger.warn(`Agent connection rejected: invalid token for ${agentId}`);
      client.disconnect();
      return;
    }

    this.logger.log(`Agent connected: ${agentId}`);
    this.socketToAgent.set(client.id, agentId);
    this.tunnelService.registerAgent(agentId, client);

    // Update last seen
    await this.agentsService.heartbeat(agentId);

    client.emit('connected', { message: 'Connected to hub' });
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
}

