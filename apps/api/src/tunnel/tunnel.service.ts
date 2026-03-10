import { Injectable, Inject, forwardRef, Optional } from '@nestjs/common';
import * as net from 'net';
import * as dgram from 'dgram';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SecureLogger } from '../common/security';
import { DebugService } from '../debug/debug.service';

interface AgentConnection {
  agentId: string;
  socket: any; // WebSocket connection
  services: Map<string, TunnelListener>;
  udpServices: Map<string, UdpTunnelListener>;
}

interface TunnelListener {
  serviceId: string;
  serviceName: string;
  port: number;
  server: net.Server;
  targetHost: string;
  targetPort: number;
}

interface UdpTunnelListener {
  serviceId: string;
  serviceName: string;
  port: number;
  server: dgram.Socket;
  targetHost: string;
  targetPort: number;
  // Track UDP sessions for response routing
  sessions: Map<string, { address: string; port: number; timestamp: number }>;
}

interface PendingConnection {
  connectionId: string;
  clientSocket: net.Socket;
  resolve: (agentSocket: net.Socket) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  ready: boolean;           // True once dial_success received
  dataBuffer: Buffer[];     // Buffer data until connection is ready
  agentId: string;          // Track which agent this connection belongs to
}

/**
 * Bridge between a reaching agent (or browser) and an exposing agent
 * Data flows: Reaching <-> Hub <-> Exposing Agent
 * reachingAgentId is '' for browser-originated bridges.
 */
interface AgentBridge {
  connectionId: string;
  serviceId: string;
  reachingAgentId: string; // '' when reaching side is a browser
  reachingSocket: any; // WebSocket of reaching agent or browser client
  exposingAgentId: string;
  exposingSocket: any; // WebSocket of exposing agent
  targetHost: string;
  targetPort: number;
  ready: boolean;
  dataBuffer: Buffer[];
  timeout: NodeJS.Timeout;
}

interface PendingHttpRequest {
  agentId: string;
  resolve: (response: { status: number; headers: Record<string, string>; body: Buffer }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface PendingChunkedResponse {
  agentId: string;
  status: number;
  headers: Record<string, string>;
  totalChunks: number;
  chunks: Map<number, Buffer>;
  resolve: (response: { status: number; headers: Record<string, string>; body: Buffer }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class TunnelService {
  private readonly logger = new SecureLogger(TunnelService.name);
  private agents = new Map<string, AgentConnection>();
  private pendingConnections = new Map<string, PendingConnection>();
  private agentBridges = new Map<string, AgentBridge>();
  private pendingHttpRequests = new Map<string, PendingHttpRequest>();
  private pendingChunkedResponses = new Map<string, PendingChunkedResponse>();
  
  // Track which connections have debug sessions
  private connectionDebugSessions = new Map<string, string>(); // connectionId -> sessionId

  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
    @Optional() @Inject(forwardRef(() => DebugService))
    private debugService?: DebugService,
  ) {}

  /**
   * Enable debug capture for a connection
   */
  enableDebugForConnection(connectionId: string, sessionId: string): void {
    this.connectionDebugSessions.set(connectionId, sessionId);
    if (this.debugService) {
      this.debugService.registerConnection(connectionId, sessionId);
    }
  }

  /**
   * Disable debug capture for a connection
   */
  disableDebugForConnection(connectionId: string): void {
    this.connectionDebugSessions.delete(connectionId);
    if (this.debugService) {
      this.debugService.unregisterConnection(connectionId);
    }
  }

  /**
   * Capture packet if debug session is active for this connection
   */
  private async capturePacket(
    connectionId: string,
    direction: 'inbound' | 'outbound',
    data: Buffer,
  ): Promise<void> {
    const sessionId = this.connectionDebugSessions.get(connectionId);
    if (!sessionId || !this.debugService) return;

    try {
      await this.debugService.capturePacket({
        sessionId,
        connectionId,
        direction,
        payload: data,
        timestamp: new Date(),
      });
    } catch (err) {
      this.logger.debug(`Failed to capture packet: ${err}`);
    }
  }

  registerAgent(agentId: string, socket: any) {
    const existing = this.agents.get(agentId);
    if (existing) {
      this.logger.log(`Agent ${agentId} reconnecting, closing stale listeners`);
      existing.services.forEach((listener) => {
        try {
          listener.server.close();
          // Force-close all existing connections on this listener
          listener.server.unref();
        } catch { /* ignore close errors */ }
      });
      existing.udpServices.forEach((listener) => {
        try {
          listener.server.close();
        } catch { /* ignore close errors */ }
      });
      
      // Reject only pending HTTP requests for this agent (not other agents)
      for (const [requestId, pending] of this.pendingHttpRequests.entries()) {
        if (pending.agentId === agentId) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Agent reconnecting'));
          this.pendingHttpRequests.delete(requestId);
        }
      }
      for (const [requestId, pending] of this.pendingChunkedResponses.entries()) {
        if (pending.agentId === agentId) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Agent reconnecting'));
          this.pendingChunkedResponses.delete(requestId);
        }
      }
    }

    this.logger.log(`Agent registered: ${agentId}`);
    this.agents.set(agentId, {
      agentId,
      socket,
      services: new Map(),
      udpServices: new Map(),
    });
  }

  /**
   * Check if a socket is the current active socket for an agent.
   * Used to prevent stale disconnects from marking agent offline after reconnection.
   */
  isCurrentSocket(agentId: string, socketId: string): boolean {
    const agent = this.agents.get(agentId);
    return agent?.socket?.id === socketId;
  }

  unregisterAgent(agentId: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Close all TCP tunnel listeners for this agent and emit disconnect webhooks
      agent.services.forEach(async (listener) => {
        this.logger.log(`Closing TCP tunnel listener on port ${listener.port}`);
        listener.server.close();

        // Emit tunnel.disconnected webhook
        try {
          const service = await this.prisma.service.findUnique({
            where: { id: listener.serviceId },
            select: { workspaceId: true, name: true },
          });
          if (service?.workspaceId) {
            this.webhooksService.emit(service.workspaceId, 'tunnel.disconnected', {
              serviceId: listener.serviceId,
              serviceName: service.name,
              agentId,
              tunnelPort: listener.port,
              disconnectedAt: new Date().toISOString(),
            }).catch(() => {}); // Fire and forget
          }
        } catch (err) {
          this.logger.error(`Failed to emit tunnel.disconnected webhook: ${err}`);
        }
      });

      // Close all UDP tunnel listeners for this agent
      agent.udpServices.forEach(async (listener) => {
        this.logger.log(`Closing UDP tunnel listener on port ${listener.port}`);
        listener.server.close();
      });

      // Clean up pending connections for this agent
      this.pendingConnections.forEach((pending, connectionId) => {
        if (pending.agentId === agentId) {
          clearTimeout(pending.timeout);
          pending.clientSocket.end();
          pending.dataBuffer = [];
          this.disableDebugForConnection(connectionId);
          this.pendingConnections.delete(connectionId);
          this.logger.log(`Cleaned up pending connection ${connectionId} for disconnected agent`);
        }
      });

      // Clean up agent bridges where this agent is involved
      this.agentBridges.forEach((bridge, connectionId) => {
        if (bridge.reachingAgentId === agentId || bridge.exposingAgentId === agentId) {
          clearTimeout(bridge.timeout);
          bridge.dataBuffer = [];

          // Notify the other agent in the bridge
          if (bridge.reachingAgentId === agentId && bridge.exposingSocket) {
            bridge.exposingSocket.emit('close', { connectionId });
          } else if (bridge.exposingAgentId === agentId && bridge.reachingSocket) {
            bridge.reachingSocket.emit('reach_error', {
              connectionId,
              error: 'Exposing agent disconnected',
            });
          }

          this.disableDebugForConnection(connectionId);
          this.agentBridges.delete(connectionId);
          this.logger.log(`Cleaned up bridge ${connectionId} for disconnected agent`);
        }
      });

      this.agents.delete(agentId);
      this.logger.log(`Agent unregistered: ${agentId}`);
    }
  }

  getAgent(agentId: string) {
    return this.agents.get(agentId);
  }

  isAgentConnected(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    return agent.socket?.connected === true;
  }

  /**
   * Get current connection statistics
   */
  getStats() {
    let totalServices = 0;
    this.agents.forEach(agent => {
      totalServices += agent.services.size;
    });

    return {
      connectedAgents: this.agents.size,
      activeServices: totalServices,
      pendingConnections: this.pendingConnections.size,
      activeBridges: this.agentBridges.size,
    };
  }

  /**
   * Validate service ownership and start the appropriate tunnel listener.
   * All service parameters (tunnelPort, targetHost, targetPort) are read from
   * the database — never from the client — to prevent port-hijacking attacks.
   */
  async exposeService(agentId: string, serviceId: string, protocol?: string): Promise<void> {
    const service = await this.prisma.withoutRls(async () =>
      this.prisma.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          agentId: true,
          name: true,
          tunnelPort: true,
          targetHost: true,
          targetPort: true,
          workspaceId: true,
        },
      }),
    );

    if (!service) {
      throw new Error('Service not found');
    }

    if (service.agentId !== agentId) {
      this.logger.warn(
        `Agent ${agentId} attempted to expose service ${serviceId} owned by agent ${service.agentId}`,
      );
      throw new Error('Not authorized to expose this service');
    }

    if (!service.tunnelPort) {
      throw new Error('Service has no assigned tunnel port');
    }

    if (protocol === 'udp') {
      await this.startUdpTunnelListener(
        agentId, serviceId, service.name,
        service.tunnelPort, service.targetHost, service.targetPort,
      );
      this.logger.log(`Started UDP tunnel for ${service.name} on port ${service.tunnelPort}`);
    } else {
      await this.startTunnelListener(
        agentId, serviceId, service.name,
        service.tunnelPort, service.targetHost, service.targetPort,
      );
      this.logger.log(`Started TCP tunnel for ${service.name} on port ${service.tunnelPort}`);
    }
  }

  /**
   * Start a tunnel listener for a service.
   * When clients connect to this port, we'll request the agent to dial the target.
   */
  private async startTunnelListener(
    agentId: string,
    serviceId: string,
    serviceName: string,
    tunnelPort: number,
    targetHost: string,
    targetPort: number,
    retryCount = 0,
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not connected`);
    }

    // Check if listener already exists
    if (agent.services.has(serviceId)) {
      const existing = agent.services.get(serviceId)!;
      if (existing.port === tunnelPort) {
        this.logger.log(`Tunnel listener already exists for ${serviceName} on port ${tunnelPort}`);
        return;
      }
      existing.server.close();
    }

    const server = net.createServer((clientSocket) => {
      this.handleIncomingConnection(agentId, serviceId, serviceName, targetHost, targetPort, clientSocket);
    });

    return new Promise((resolve, reject) => {
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retryCount < 3) {
          this.logger.warn(`Port ${tunnelPort} in use for ${serviceName}, retrying in ${(retryCount + 1) * 500}ms...`);
          server.close();
          setTimeout(() => {
            this.startTunnelListener(agentId, serviceId, serviceName, tunnelPort, targetHost, targetPort, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, (retryCount + 1) * 500);
          return;
        }
        this.logger.error(`Tunnel listener error on port ${tunnelPort}: ${err.message}`);
        reject(err);
      });

      server.listen(tunnelPort, '127.0.0.1', async () => {
        this.logger.log(`Tunnel listener started for ${serviceName} on port ${tunnelPort}`);
        agent.services.set(serviceId, {
          serviceId,
          serviceName,
          port: tunnelPort,
          server,
          targetHost,
          targetPort,
        });

        // Emit tunnel.connected webhook
        try {
          const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            select: { workspaceId: true, name: true, agentId: true },
          });
          if (service?.workspaceId) {
            this.webhooksService.emit(service.workspaceId, 'tunnel.connected', {
              serviceId,
              serviceName: service.name,
              agentId: service.agentId,
              tunnelPort,
              targetHost,
              targetPort,
              connectedAt: new Date().toISOString(),
            }).catch(() => {}); // Fire and forget
          }
        } catch (err) {
          this.logger.error(`Failed to emit tunnel.connected webhook: ${err}`);
        }

        resolve();
      });
    });
  }

  /**
   * Start a UDP tunnel listener for a service.
   * When datagrams arrive, we'll forward them to the agent.
   */
  private async startUdpTunnelListener(
    agentId: string,
    serviceId: string,
    serviceName: string,
    tunnelPort: number,
    targetHost: string,
    targetPort: number,
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not connected`);
    }

    // Check if UDP listener already exists
    if (agent.udpServices.has(serviceId)) {
      const existing = agent.udpServices.get(serviceId)!;
      if (existing.port === tunnelPort) {
        this.logger.log(`UDP tunnel listener already exists for ${serviceName} on port ${tunnelPort}`);
        return;
      }
      // Close old listener
      existing.server.close();
    }

    const server = dgram.createSocket('udp4');
    const sessions = new Map<string, { address: string; port: number; timestamp: number }>();

    server.on('message', (msg, rinfo) => {
      this.handleUdpDatagram(agentId, serviceId, serviceName, targetHost, targetPort, msg, rinfo, sessions);
    });

    server.on('error', (err) => {
      this.logger.error(`UDP tunnel listener error on port ${tunnelPort}: ${err.message}`);
    });

    return new Promise((resolve, reject) => {
      server.on('error', (err) => {
        reject(err);
      });

      server.bind(tunnelPort, '127.0.0.1', async () => {
        this.logger.log(`UDP tunnel listener started for ${serviceName} on port ${tunnelPort}`);
        agent.udpServices.set(serviceId, {
          serviceId,
          serviceName,
          port: tunnelPort,
          server,
          targetHost,
          targetPort,
          sessions,
        });
        resolve();
      });
    });
  }

  /**
   * Handle an incoming UDP datagram to a tunnel port.
   * Forward to the agent via WebSocket.
   */
  private handleUdpDatagram(
    agentId: string,
    serviceId: string,
    serviceName: string,
    targetHost: string,
    targetPort: number,
    msg: Buffer,
    rinfo: dgram.RemoteInfo,
    sessions: Map<string, { address: string; port: number; timestamp: number }>,
  ) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.logger.error(`Agent ${agentId} not connected, dropping UDP datagram`);
      return;
    }

    const now = Date.now();
    const sessionId = `${rinfo.address}:${rinfo.port}-${now}`;
    sessions.set(sessionId, { address: rinfo.address, port: rinfo.port, timestamp: now });

    // Prune sessions older than 60 seconds to prevent unbounded growth
    // from datagrams that never receive a response.
    const SESSION_TTL_MS = 60_000;
    if (sessions.size > 100) {
      for (const [id, s] of sessions) {
        if (now - s.timestamp > SESSION_TTL_MS) sessions.delete(id);
      }
    }

    this.logger.debug(`UDP datagram from ${rinfo.address}:${rinfo.port} for ${serviceName} (${msg.length} bytes)`);

    // Forward to agent
    agent.socket.emit('udp_datagram', {
      sessionId,
      serviceId,
      data: msg.toString('base64'),
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
      targetHost,
      targetPort,
    });
  }

  /**
   * Handle UDP response from agent - send datagram back to client.
   * Looks up the original client address from the sessions map rather
   * than parsing the sessionId, preventing agents from sending UDP
   * packets to arbitrary destinations.
   */
  handleUdpResponse(agentId: string, serviceId: string, sessionId: string, data: Buffer) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.logger.warn(`Agent ${agentId} not found for UDP response`);
      return;
    }

    const udpListener = agent.udpServices.get(serviceId);
    if (!udpListener) {
      this.logger.warn(`UDP listener not found for service ${serviceId}`);
      return;
    }

    const session = udpListener.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Unknown UDP session ${sessionId} for service ${serviceId}`);
      return;
    }

    udpListener.sessions.delete(sessionId);

    udpListener.server.send(data, session.port, session.address, (err) => {
      if (err) {
        this.logger.error(`UDP send error: ${err.message}`);
      }
    });
  }

  /**
   * Handle an incoming connection to a tunnel port.
   * Request the agent to dial the target and pipe data.
   * 
   * IMPORTANT: Data is buffered until dial confirmation to prevent race conditions
   * under poor network conditions.
   */
  private handleIncomingConnection(
    agentId: string,
    serviceId: string,
    serviceName: string,
    targetHost: string,
    targetPort: number,
    clientSocket: net.Socket,
  ) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.logger.error(`Agent ${agentId} not connected, closing client socket`);
      clientSocket.end();
      return;
    }

    const connectionId = uuidv4();
    this.logger.log(`New connection ${connectionId} for ${serviceName}, requesting agent dial...`);

    // Request agent to dial the target
    agent.socket.emit('dial', {
      connectionId,
      targetHost,
      targetPort,
      serviceId,
    });

    // Wait for agent to confirm connection (increased timeout for slow networks)
    const timeout = setTimeout(() => {
      this.logger.error(`Connection ${connectionId} timed out waiting for agent`);
      const pending = this.pendingConnections.get(connectionId);
      if (pending) {
        // Clear the buffer to free memory
        pending.dataBuffer = [];
      }
      this.pendingConnections.delete(connectionId);
      clientSocket.end();
    }, 30000); // Increased from 10s to 30s for slow networks

    // Initialize pending connection with buffer for race condition prevention
    this.pendingConnections.set(connectionId, {
      connectionId,
      clientSocket,
      resolve: () => {},
      reject: () => {},
      timeout,
      ready: false,        // Not ready until dial_success
      dataBuffer: [],      // Buffer data until ready
      agentId,
    });

    // Buffer or forward client data depending on connection state
    clientSocket.on('data', (data: Buffer) => {
      const pending = this.pendingConnections.get(connectionId);
      if (!pending) return;
      
      if (pending.ready) {
        // Connection is ready, forward immediately
        this.sendToAgent(agentId, connectionId, data);
      } else {
        // Connection not ready, buffer the data (with size limit)
        const totalBufferSize = pending.dataBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer
        
        if (totalBufferSize + data.length > MAX_BUFFER_SIZE) {
          this.logger.warn(`Connection ${connectionId} buffer overflow, dropping connection`);
          clientSocket.end();
          this.pendingConnections.delete(connectionId);
          clearTimeout(timeout);
          agent.socket.emit('close', { connectionId });
          return;
        }
        
        pending.dataBuffer.push(Buffer.from(data));
      }
    });

    clientSocket.on('error', (err) => {
      this.logger.error(`Client socket error: ${err.message}`);
      const pending = this.pendingConnections.get(connectionId);
      if (pending) {
        pending.dataBuffer = []; // Clear buffer
        clearTimeout(pending.timeout);
      }
      this.pendingConnections.delete(connectionId);
      // Notify agent to close the connection on its end
      agent.socket.emit('close', { connectionId });
    });

    clientSocket.on('close', () => {
      this.disableDebugForConnection(connectionId);
      const pending = this.pendingConnections.get(connectionId);
      if (pending) {
        pending.dataBuffer = [];
        clearTimeout(pending.timeout);
        this.pendingConnections.delete(connectionId);
        agent.socket.emit('close', { connectionId });
      }
    });
  }

  /**
   * Called when agent confirms it has dialed the target.
   * Now we pipe data between client and agent.
   * 
   * IMPORTANT: Flushes any buffered data that arrived before dial confirmation.
   */
  handleAgentDialSuccess(connectionId: string, agentId: string) {
    // First check if this is an agent bridge
    if (this.handleAgentDialSuccessForBridge(connectionId)) {
      return;
    }

    const pending = this.pendingConnections.get(connectionId);
    if (!pending) {
      this.logger.warn(`No pending connection for ${connectionId}`);
      return;
    }

    // Validate that the agent owns this connection
    if (pending.agentId !== agentId) {
      this.logger.error(`Agent ${agentId} attempted to hijack connection ${connectionId} belonging to ${pending.agentId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.logger.log(`Agent dial successful for ${connectionId}`);
    
    // Check for active debug session and enable capture
    if (this.debugService) {
      const sessionId = this.debugService.getSessionForAgent(agentId);
      if (sessionId) {
        this.enableDebugForConnection(connectionId, sessionId);
        this.logger.log(`Debug capture enabled for connection ${connectionId} (session ${sessionId})`);
      }
    }
    
    // Mark connection as ready
    pending.ready = true;
    
    // Flush any buffered data that arrived before dial confirmation
    if (pending.dataBuffer.length > 0) {
      const bufferedSize = pending.dataBuffer.reduce((sum, buf) => sum + buf.length, 0);
      this.logger.log(`Flushing ${pending.dataBuffer.length} buffered chunks (${bufferedSize} bytes) for ${connectionId}`);
      
      for (const chunk of pending.dataBuffer) {
        this.sendToAgent(agentId, connectionId, chunk);
      }
      pending.dataBuffer = []; // Clear buffer after flush
    }
  }

  /**
   * Receive data from agent for a connection
   */
  handleAgentData(connectionId: string, data: Buffer, agentId: string) {
    // Capture for debug session (inbound = from target service)
    this.capturePacket(connectionId, 'inbound', data);

    // First check if this is an agent bridge
    if (this.handleAgentDataForBridge(connectionId, data, agentId)) {
      return;
    }

    const pending = this.pendingConnections.get(connectionId);
    if (!pending) {
      return;
    }

    // Validate that the agent owns this connection
    if (pending.agentId !== agentId) {
      this.logger.error(`Agent ${agentId} attempted to send data for connection ${connectionId} belonging to ${pending.agentId}`);
      return;
    }

    if (!pending.clientSocket.destroyed) {
      pending.clientSocket.write(data);
    }
  }

  /**
   * Send data to agent for a connection
   */
  sendToAgent(agentId: string, connectionId: string, data: Buffer) {
    // Capture for debug session (outbound = to target service)
    this.capturePacket(connectionId, 'outbound', data);

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.socket.emit('data', {
        connectionId,
        data: data.toString('base64'),
      });
    }
  }

  /**
   * Handle connection close from agent
   */
  handleAgentClose(connectionId: string, agentId: string) {
    // Clean up debug session tracking
    this.disableDebugForConnection(connectionId);

    // First check if this is an agent bridge
    if (this.handleAgentCloseForBridge(connectionId, agentId)) {
      return;
    }

    const pending = this.pendingConnections.get(connectionId);
    if (pending) {
      // Validate that the agent owns this connection
      if (pending.agentId !== agentId) {
        this.logger.error(`Agent ${agentId} attempted to close connection ${connectionId} belonging to ${pending.agentId}`);
        return;
      }

      clearTimeout(pending.timeout);
      pending.clientSocket.end();
      this.pendingConnections.delete(connectionId);
    }
  }

  /**
   * Get pending connection for setting up data pipe
   */
  getPendingConnection(connectionId: string) {
    return this.pendingConnections.get(connectionId);
  }

  /**
   * Forward an HTTP request through the agent's WebSocket connection.
   * Used by share proxying to avoid depending on the TCP tunnel listener.
   */
  async forwardHttpRequest(
    agentId: string,
    serviceId: string,
    request: { method: string; path: string; headers: Record<string, string>; body: string | Buffer },
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not connected');
    }

    if (!agent.socket?.connected) {
      throw new Error('Agent not connected');
    }

    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingHttpRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 60000);

      this.pendingHttpRequests.set(requestId, { agentId, resolve, reject, timeout });

      const payload = {
        requestId,
        serviceId,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: typeof request.body === 'string' ? request.body : request.body.toString('base64'),
      };

      agent.socket.timeout(5000).emit('http_request', payload, (err: Error | null) => {
        if (err) {
          const pending = this.pendingHttpRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingHttpRequests.delete(requestId);
            reject(new Error('Agent not connected'));
          }
        }
      });
    });
  }

  /**
   * Handle HTTP response from agent (callback for forwardHttpRequest)
   */
  handleHttpResponse(
    requestId: string,
    agentId: string,
    response: { status: number; headers: Record<string, string>; body: string | Buffer; bodyEncoding?: string },
  ): void {
    const pending = this.pendingHttpRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingHttpRequests.delete(requestId);
      let bodyBuffer: Buffer;
      if (Buffer.isBuffer(response.body)) {
        bodyBuffer = response.body;
      } else if (response.bodyEncoding === 'base64') {
        bodyBuffer = Buffer.from(response.body, 'base64');
      } else {
        bodyBuffer = Buffer.from(response.body, 'utf-8');
      }
      pending.resolve({
        status: response.status,
        headers: response.headers,
        body: bodyBuffer,
      });
    }
  }

  handleHttpResponseStart(
    requestId: string,
    agentId: string,
    data: { status: number; headers: Record<string, string>; totalChunks: number },
  ): void {
    const pending = this.pendingHttpRequests.get(requestId);
    if (!pending) return;
    if (pending.agentId !== agentId) {
      this.logger.warn(`Agent ${agentId} sent http_response_start for request ${requestId} belonging to ${pending.agentId}, ignoring`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingHttpRequests.delete(requestId);

    const timeout = setTimeout(() => {
      this.pendingChunkedResponses.delete(requestId);
      pending.reject(new Error('Request timeout'));
    }, 120000);

    this.pendingChunkedResponses.set(requestId, {
      agentId: pending.agentId,
      status: data.status,
      headers: data.headers,
      totalChunks: data.totalChunks,
      chunks: new Map(),
      resolve: pending.resolve,
      reject: pending.reject,
      timeout,
    });
  }

  handleHttpResponseChunk(
    requestId: string,
    agentId: string,
    data: { index: number; data: Buffer | string; bodyEncoding?: string },
  ): void {
    const pending = this.pendingChunkedResponses.get(requestId);
    if (!pending) return;
    if (pending.agentId !== agentId) {
      this.logger.warn(`Agent ${agentId} sent http_response_chunk for request ${requestId} belonging to ${pending.agentId}, ignoring`);
      return;
    }
    const chunkData = Buffer.isBuffer(data.data)
      ? data.data
      : data.bodyEncoding === 'base64'
        ? Buffer.from(data.data, 'base64')
        : Buffer.from(data.data, 'utf-8');
    pending.chunks.set(data.index, chunkData);
  }

  handleHttpResponseEnd(requestId: string, agentId: string): void {
    const pending = this.pendingChunkedResponses.get(requestId);
    if (!pending) return;
    if (pending.agentId !== agentId) {
      this.logger.warn(`Agent ${agentId} sent http_response_end for request ${requestId} belonging to ${pending.agentId}, ignoring`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingChunkedResponses.delete(requestId);

    for (let i = 0; i < pending.totalChunks; i++) {
      if (!pending.chunks.has(i)) {
        pending.reject(
          new Error(`Incomplete response: missing chunk ${i}, received ${pending.chunks.size} of ${pending.totalChunks} chunks`),
        );
        return;
      }
    }

    const sorted = Array.from(pending.chunks.entries())
      .sort(([a], [b]) => a - b)
      .map(([, buf]) => buf);

    pending.resolve({
      status: pending.status,
      headers: pending.headers,
      body: Buffer.concat(sorted),
    });
  }

  /**
   * Stop tunnel listener for a service
   */
  stopTunnelListener(agentId: string, serviceId: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      const listener = agent.services.get(serviceId);
      if (listener) {
        listener.server.close();
        agent.services.delete(serviceId);
        this.logger.log(`Stopped tunnel listener for service ${serviceId}`);
      }
    }
  }

  /**
   * Create a bridge between a reaching agent and an exposing agent.
   * This allows agent-to-agent connectivity through the hub.
   */
  async createAgentBridge(
    connectionId: string,
    serviceId: string,
    reachingAgentId: string,
    reachingSocket: any,
  ): Promise<void> {
    // Find the service and its exposing agent
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { agent: true },
    });

    if (!service) {
      throw new Error('Service not found');
    }

    if (!service.agentId) {
      throw new Error('Service has no associated agent');
    }

    const exposingAgent = this.agents.get(service.agentId);
    if (!exposingAgent) {
      throw new Error('Exposing agent is not connected');
    }

    this.logger.log(`Creating bridge ${connectionId}: ${reachingAgentId} -> ${service.agentId} for ${service.name}`);

    const timeout = setTimeout(() => {
      this.logger.error(`Bridge ${connectionId} timed out waiting for dial`);
      const bridge = this.agentBridges.get(connectionId);
      if (bridge) {
        bridge.dataBuffer = [];
        bridge.reachingSocket.emit('reach_error', { connectionId, error: 'Connection timeout' });
        this.disableDebugForConnection(connectionId);
        this.agentBridges.delete(connectionId);
      }
    }, 10000);

    // Create the bridge
    const bridge: AgentBridge = {
      connectionId,
      serviceId,
      reachingAgentId,
      reachingSocket,
      exposingAgentId: service.agentId,
      exposingSocket: exposingAgent.socket,
      targetHost: service.targetHost,
      targetPort: service.targetPort,
      ready: false,
      dataBuffer: [],
      timeout,
    };

    this.agentBridges.set(connectionId, bridge);

    // Ask the exposing agent to dial the target
    exposingAgent.socket.emit('dial', {
      connectionId,
      targetHost: service.targetHost,
      targetPort: service.targetPort,
      serviceId,
    });
  }

  /**
   * Called when the exposing agent confirms dial success.
   * Updated to handle both TCP client connections and agent bridges.
   */
  handleAgentDialSuccessForBridge(connectionId: string) {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge) {
      clearTimeout(bridge.timeout);
      bridge.ready = true;
      this.logger.log(`Bridge ${connectionId} ready`);

      // Enable debug capture for bridge connections
      if (this.debugService) {
        const sessionId = this.debugService.getSessionForAgent(bridge.exposingAgentId);
        if (sessionId) {
          this.enableDebugForConnection(connectionId, sessionId);
          this.logger.log(`Debug capture enabled for bridge ${connectionId} (session ${sessionId})`);
        }
      }

      // Flush any data that was buffered before the bridge was ready
      if (bridge.dataBuffer.length > 0) {
        const bufferedSize = bridge.dataBuffer.reduce((sum, buf) => sum + buf.length, 0);
        this.logger.log(`Flushing ${bridge.dataBuffer.length} buffered chunks (${bufferedSize} bytes) for bridge ${connectionId}`);
        for (const chunk of bridge.dataBuffer) {
          bridge.exposingSocket.emit('data', {
            connectionId,
            data: chunk.toString('base64'),
          });
        }
        bridge.dataBuffer = [];
      }

      // Notify the reaching side (agent or browser) that the connection is ready
      bridge.reachingSocket.emit('reach_ready', { connectionId });
      return true;
    }
    return false;
  }

  /**
   * Create a bridge from a browser client to an exposing agent (for browser terminal).
   * Same as createAgentBridge but reachingAgentId is '' and reachingSocket is the browser.
   */
  async createBrowserBridge(
    connectionId: string,
    serviceId: string,
    browserSocket: any,
  ): Promise<void> {
    return this.createAgentBridge(connectionId, serviceId, '', browserSocket);
  }

  /**
   * Handle data from browser (reaching side) -> exposing agent
   */
  handleReachDataFromBrowser(connectionId: string, data: Buffer): void {
    const bridge = this.agentBridges.get(connectionId);
    if (!bridge || bridge.reachingAgentId !== '') {
      return;
    }
    this.handleReachData(connectionId, data, '');
  }

  /**
   * Handle close from browser (reaching side)
   */
  handleReachCloseFromBrowser(connectionId: string): void {
    const bridge = this.agentBridges.get(connectionId);
    if (!bridge || bridge.reachingAgentId !== '') {
      return;
    }
    this.handleReachClose(connectionId, '');
  }

  /**
   * Handle data from reaching agent -> exposing agent
   */
  handleReachData(connectionId: string, data: Buffer, agentId: string) {
    // Capture for debug session (outbound = going to target)
    this.capturePacket(connectionId, 'outbound', data);

    const bridge = this.agentBridges.get(connectionId);
    if (!bridge) {
      return;
    }

    // Validate that the sender is the reaching side (agent or browser when agentId is '')
    if (bridge.reachingAgentId !== agentId) {
      this.logger.error(`Agent ${agentId} attempted to send reach data for bridge ${connectionId} belonging to ${bridge.reachingAgentId || '(browser)'}`);
      return;
    }

    if (bridge.ready) {
      // Forward to exposing agent
      bridge.exposingSocket.emit('data', {
        connectionId,
        data: data.toString('base64'),
      });
    } else {
      const totalBufferSize = bridge.dataBuffer.reduce((sum, buf) => sum + buf.length, 0);
      const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer

      if (totalBufferSize + data.length > MAX_BUFFER_SIZE) {
        this.logger.warn(`Bridge ${connectionId} buffer overflow, tearing down`);
        clearTimeout(bridge.timeout);
        bridge.reachingSocket.emit('reach_error', { connectionId, error: 'Buffer overflow' });
        bridge.exposingSocket.emit('close', { connectionId });
        bridge.dataBuffer = [];
        this.agentBridges.delete(connectionId);
        return;
      }

      bridge.dataBuffer.push(Buffer.from(data));
    }
  }

  /**
   * Handle data from exposing agent -> reaching agent (for bridges)
   */
  handleAgentDataForBridge(connectionId: string, data: Buffer, agentId: string): boolean {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge && bridge.ready) {
      // Validate that the agent is the exposing agent for this bridge
      if (bridge.exposingAgentId !== agentId) {
        this.logger.error(`Agent ${agentId} attempted to send bridge data for ${connectionId} belonging to exposing agent ${bridge.exposingAgentId}`);
        return true; // Return true to prevent falling through to pendingConnections check
      }

      // Capture for debug session (inbound = from target service)
      this.capturePacket(connectionId, 'inbound', data);

      // Forward to reaching agent
      bridge.reachingSocket.emit('reach_data', {
        connectionId,
        data: data.toString('base64'),
      });
      return true;
    }
    return false;
  }

  /**
   * Handle close from reaching agent
   */
  handleReachClose(connectionId: string, agentId: string) {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge) {
      if (bridge.reachingAgentId !== agentId) {
        this.logger.error(`Agent ${agentId} attempted to close bridge ${connectionId} belonging to ${bridge.reachingAgentId || '(browser)'}`);
        return;
      }

      clearTimeout(bridge.timeout);
      bridge.dataBuffer = [];
      bridge.exposingSocket.emit('close', { connectionId });
      this.disableDebugForConnection(connectionId);
      this.agentBridges.delete(connectionId);
      this.logger.log(`Bridge ${connectionId} closed by reaching agent`);
    }
  }

  /**
   * Handle close from exposing agent (for bridges)
   */
  handleAgentCloseForBridge(connectionId: string, agentId: string): boolean {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge) {
      if (bridge.exposingAgentId !== agentId) {
        this.logger.error(`Agent ${agentId} attempted to close bridge ${connectionId} belonging to exposing agent ${bridge.exposingAgentId}`);
        return true;
      }

      clearTimeout(bridge.timeout);
      bridge.dataBuffer = [];
      bridge.reachingSocket.emit('reach_close', { connectionId });
      this.disableDebugForConnection(connectionId);
      this.agentBridges.delete(connectionId);
      this.logger.log(`Bridge ${connectionId} closed by exposing agent`);
      return true;
    }
    return false;
  }
}

