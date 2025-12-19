import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('RealtimeGateway');
  private clients = new Set<string>();

  handleConnection(client: Socket) {
    this.clients.add(client.id);
    this.logger.log(`Client connected: ${client.id} (total: ${this.clients.size})`);
    
    // Send initial connection confirmation
    client.emit('connected', { message: 'Connected to realtime updates' });
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (total: ${this.clients.size})`);
  }

  broadcastServiceUpdate(service: any) {
    this.server?.emit('service:update', service);
  }

  broadcastDiagnosticResult(diagnostic: any) {
    this.server?.emit('diagnostic:new', diagnostic);
  }

  broadcastAgentStatus(agentId: string, isOnline: boolean) {
    this.server?.emit('agent:status', { agentId, isOnline });
  }
}
