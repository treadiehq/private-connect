import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

interface AgentConnection {
  agentId: string;
  socket: any; // WebSocket connection
  services: Map<string, TunnelListener>;
}

interface TunnelListener {
  serviceId: string;
  serviceName: string;
  port: number;
  server: net.Server;
  targetHost: string;
  targetPort: number;
}

interface PendingConnection {
  connectionId: string;
  clientSocket: net.Socket;
  resolve: (agentSocket: net.Socket) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Bridge between a reaching agent and an exposing agent
 * Data flows: Reaching Agent <-> Hub <-> Exposing Agent
 */
interface AgentBridge {
  connectionId: string;
  serviceId: string;
  reachingAgentId: string;
  reachingSocket: any; // WebSocket of reaching agent
  exposingAgentId: string;
  exposingSocket: any; // WebSocket of exposing agent
  targetHost: string;
  targetPort: number;
  ready: boolean;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class TunnelService {
  private readonly logger = new Logger(TunnelService.name);
  private agents = new Map<string, AgentConnection>();
  private pendingConnections = new Map<string, PendingConnection>();
  private agentBridges = new Map<string, AgentBridge>();

  constructor(private prisma: PrismaService) {}

  registerAgent(agentId: string, socket: any) {
    this.logger.log(`Agent registered: ${agentId}`);
    this.agents.set(agentId, {
      agentId,
      socket,
      services: new Map(),
    });
  }

  unregisterAgent(agentId: string) {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Close all tunnel listeners for this agent
      agent.services.forEach((listener) => {
        this.logger.log(`Closing tunnel listener on port ${listener.port}`);
        listener.server.close();
      });
      this.agents.delete(agentId);
      this.logger.log(`Agent unregistered: ${agentId}`);
    }
  }

  getAgent(agentId: string) {
    return this.agents.get(agentId);
  }

  isAgentConnected(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Start a tunnel listener for a service.
   * When clients connect to this port, we'll request the agent to dial the target.
   */
  async startTunnelListener(
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

    // Check if listener already exists
    if (agent.services.has(serviceId)) {
      const existing = agent.services.get(serviceId)!;
      if (existing.port === tunnelPort) {
        this.logger.log(`Tunnel listener already exists for ${serviceName} on port ${tunnelPort}`);
        return;
      }
      // Close old listener
      existing.server.close();
    }

    const server = net.createServer((clientSocket) => {
      this.handleIncomingConnection(agentId, serviceId, serviceName, targetHost, targetPort, clientSocket);
    });

    return new Promise((resolve, reject) => {
      server.on('error', (err) => {
        this.logger.error(`Tunnel listener error on port ${tunnelPort}: ${err.message}`);
        reject(err);
      });

      server.listen(tunnelPort, '127.0.0.1', () => {
        this.logger.log(`Tunnel listener started for ${serviceName} on port ${tunnelPort}`);
        agent.services.set(serviceId, {
          serviceId,
          serviceName,
          port: tunnelPort,
          server,
          targetHost,
          targetPort,
        });
        resolve();
      });
    });
  }

  /**
   * Handle an incoming connection to a tunnel port.
   * Request the agent to dial the target and pipe data.
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

    // Wait for agent to confirm connection
    const timeout = setTimeout(() => {
      this.logger.error(`Connection ${connectionId} timed out waiting for agent`);
      this.pendingConnections.delete(connectionId);
      clientSocket.end();
    }, 10000);

    this.pendingConnections.set(connectionId, {
      connectionId,
      clientSocket,
      resolve: () => {},
      reject: () => {},
      timeout,
    });

    // Forward client data to agent via WebSocket
    clientSocket.on('data', (data: Buffer) => {
      this.sendToAgent(agentId, connectionId, data);
    });

    clientSocket.on('error', (err) => {
      this.logger.error(`Client socket error: ${err.message}`);
      this.pendingConnections.delete(connectionId);
      clearTimeout(timeout);
      // Notify agent to close the connection on its end
      agent.socket.emit('close', { connectionId });
    });

    clientSocket.on('close', () => {
      if (this.pendingConnections.has(connectionId)) {
        this.pendingConnections.delete(connectionId);
        clearTimeout(timeout);
        // Notify agent to close the connection on its end
        agent.socket.emit('close', { connectionId });
      }
    });
  }

  /**
   * Called when agent confirms it has dialed the target.
   * Now we pipe data between client and agent.
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

    clearTimeout(pending.timeout);
    this.logger.log(`Agent dial successful for ${connectionId}`);
    
    // Connection is now ready - data will be piped through WebSocket
    // The agent will handle the actual data transfer
  }

  /**
   * Receive data from agent for a connection
   */
  handleAgentData(connectionId: string, data: Buffer) {
    // First check if this is an agent bridge
    if (this.handleAgentDataForBridge(connectionId, data)) {
      return;
    }

    const pending = this.pendingConnections.get(connectionId);
    if (pending && !pending.clientSocket.destroyed) {
      pending.clientSocket.write(data);
    }
  }

  /**
   * Send data to agent for a connection
   */
  sendToAgent(agentId: string, connectionId: string, data: Buffer) {
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
  handleAgentClose(connectionId: string) {
    // First check if this is an agent bridge
    if (this.handleAgentCloseForBridge(connectionId)) {
      return;
    }

    const pending = this.pendingConnections.get(connectionId);
    if (pending) {
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

    // Set up timeout
    const timeout = setTimeout(() => {
      this.logger.error(`Bridge ${connectionId} timed out waiting for dial`);
      const bridge = this.agentBridges.get(connectionId);
      if (bridge) {
        bridge.reachingSocket.emit('reach_error', { connectionId, error: 'Connection timeout' });
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
      
      // Notify the reaching agent that the connection is ready
      bridge.reachingSocket.emit('reach_ready', { connectionId });
      return true;
    }
    return false;
  }

  /**
   * Handle data from reaching agent -> exposing agent
   */
  handleReachData(connectionId: string, data: Buffer) {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge && bridge.ready) {
      // Forward to exposing agent
      bridge.exposingSocket.emit('data', {
        connectionId,
        data: data.toString('base64'),
      });
    }
  }

  /**
   * Handle data from exposing agent -> reaching agent (for bridges)
   */
  handleAgentDataForBridge(connectionId: string, data: Buffer): boolean {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge && bridge.ready) {
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
  handleReachClose(connectionId: string) {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge) {
      clearTimeout(bridge.timeout);
      // Tell exposing agent to close
      bridge.exposingSocket.emit('close', { connectionId });
      this.agentBridges.delete(connectionId);
      this.logger.log(`Bridge ${connectionId} closed by reaching agent`);
    }
  }

  /**
   * Handle close from exposing agent (for bridges)
   */
  handleAgentCloseForBridge(connectionId: string): boolean {
    const bridge = this.agentBridges.get(connectionId);
    if (bridge) {
      clearTimeout(bridge.timeout);
      // Tell reaching agent to close
      bridge.reachingSocket.emit('reach_close', { connectionId });
      this.agentBridges.delete(connectionId);
      this.logger.log(`Bridge ${connectionId} closed by exposing agent`);
      return true;
    }
    return false;
  }
}

