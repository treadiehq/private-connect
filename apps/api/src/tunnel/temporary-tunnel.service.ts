import { Injectable } from '@nestjs/common';
import { SecureLogger } from '../common/security';
import * as net from 'net';

type TunnelType = 'http' | 'tcp';

interface TemporaryTunnel {
  tunnelId: string;
  type: TunnelType;
  localHost: string;
  localPort: number;
  createdAt: Date;
  expiresAt: Date;
  socket: any | null; // WebSocket connection from CLI
  requestCount: number;
  // TCP-specific
  tcpPort?: number;
  tcpServer?: net.Server;
}

interface PendingRequest {
  resolve: (response: { status: number; headers: Record<string, string>; body: string }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface TcpConnection {
  connectionId: string;
  clientSocket: net.Socket;
  ready: boolean;
  dataBuffer: Buffer[];
}

// TCP port range for temporary tunnels
const TCP_PORT_MIN = 40000;
const TCP_PORT_MAX = 50000;

/**
 * Service for managing temporary tunnels (no auth required)
 * Tunnels auto-expire after TTL
 * Supports both HTTP and raw TCP tunnels
 */
@Injectable()
export class TemporaryTunnelService {
  private readonly logger = new SecureLogger(TemporaryTunnelService.name);
  private tunnels = new Map<string, TemporaryTunnel>();
  private pendingRequests = new Map<string, PendingRequest>();
  private tcpConnections = new Map<string, TcpConnection>();
  private allocatedPorts = new Set<number>();
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Cleanup expired tunnels every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
  }

  /**
   * Create a new HTTP temporary tunnel
   */
  createTunnel(tunnelId: string, localHost: string, localPort: number, ttlMinutes: number): TemporaryTunnel {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    const tunnel: TemporaryTunnel = {
      tunnelId,
      type: 'http',
      localHost,
      localPort,
      createdAt: now,
      expiresAt,
      socket: null,
      requestCount: 0,
    };
    
    this.tunnels.set(tunnelId, tunnel);
    this.logger.log(`Created HTTP temporary tunnel ${tunnelId}, expires at ${expiresAt.toISOString()}`);
    
    return tunnel;
  }

  /**
   * Create a new TCP temporary tunnel with dynamic port allocation
   */
  async createTcpTunnel(tunnelId: string, localHost: string, localPort: number, ttlMinutes: number): Promise<TemporaryTunnel> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    // Allocate a port
    const tcpPort = await this.allocatePort();
    if (!tcpPort) {
      throw new Error('No available ports for TCP tunnel');
    }
    
    const tunnel: TemporaryTunnel = {
      tunnelId,
      type: 'tcp',
      localHost,
      localPort,
      createdAt: now,
      expiresAt,
      socket: null,
      requestCount: 0,
      tcpPort,
    };
    
    this.tunnels.set(tunnelId, tunnel);
    this.logger.log(`Created TCP temporary tunnel ${tunnelId} on port ${tcpPort}, expires at ${expiresAt.toISOString()}`);
    
    return tunnel;
  }

  /**
   * Start TCP server for a tunnel (called after CLI connects)
   */
  async startTcpServer(tunnelId: string): Promise<void> {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel || tunnel.type !== 'tcp' || !tunnel.tcpPort) {
      throw new Error('TCP tunnel not found');
    }
    
    if (tunnel.tcpServer) {
      return; // Already running
    }
    
    return new Promise((resolve, reject) => {
      const server = net.createServer((clientSocket) => {
        this.handleTcpConnection(tunnelId, clientSocket);
      });
      
      server.on('error', (err) => {
        this.logger.error(`TCP server error for tunnel ${tunnelId}: ${err.message}`);
        reject(err);
      });
      
      server.listen(tunnel.tcpPort, '0.0.0.0', () => {
        this.logger.log(`TCP server started for tunnel ${tunnelId} on port ${tunnel.tcpPort}`);
        tunnel.tcpServer = server;
        resolve();
      });
    });
  }

  /**
   * Handle incoming TCP connection
   */
  private handleTcpConnection(tunnelId: string, clientSocket: net.Socket): void {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel || !tunnel.socket?.connected) {
      this.logger.warn(`TCP connection rejected: tunnel ${tunnelId} not connected`);
      clientSocket.end();
      return;
    }
    
    const connectionId = `${tunnelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tunnel.requestCount++;
    
    this.logger.log(`New TCP connection ${connectionId} for tunnel ${tunnelId}`);
    
    // Store connection
    const conn: TcpConnection = {
      connectionId,
      clientSocket,
      ready: false,
      dataBuffer: [],
    };
    this.tcpConnections.set(connectionId, conn);
    
    // Request CLI to dial local target
    tunnel.socket.emit('tcp_dial', {
      connectionId,
      targetHost: tunnel.localHost,
      targetPort: tunnel.localPort,
    });
    
    // Buffer data until connection is ready
    clientSocket.on('data', (data: Buffer) => {
      const c = this.tcpConnections.get(connectionId);
      if (!c) return;
      
      if (!c.ready) {
        c.dataBuffer.push(data);
      } else {
        // Forward to CLI
        tunnel.socket?.emit('tcp_data', {
          connectionId,
          data: data.toString('base64'),
        });
      }
    });
    
    clientSocket.on('close', () => {
      this.logger.log(`TCP connection ${connectionId} closed`);
      tunnel.socket?.emit('tcp_close', { connectionId });
      this.tcpConnections.delete(connectionId);
    });
    
    clientSocket.on('error', (err) => {
      this.logger.warn(`TCP connection ${connectionId} error: ${err.message}`);
      this.tcpConnections.delete(connectionId);
    });
    
    // Timeout for dial
    setTimeout(() => {
      const c = this.tcpConnections.get(connectionId);
      if (c && !c.ready) {
        this.logger.warn(`TCP connection ${connectionId} dial timeout`);
        clientSocket.end();
        this.tcpConnections.delete(connectionId);
      }
    }, 30000);
  }

  /**
   * Handle TCP dial success from CLI
   */
  handleTcpDialSuccess(connectionId: string): void {
    const conn = this.tcpConnections.get(connectionId);
    if (!conn) return;
    
    conn.ready = true;
    
    // Flush buffered data
    const tunnelId = connectionId.split('-')[0];
    const tunnel = this.getTunnel(tunnelId);
    if (tunnel?.socket) {
      for (const chunk of conn.dataBuffer) {
        tunnel.socket.emit('tcp_data', {
          connectionId,
          data: chunk.toString('base64'),
        });
      }
      conn.dataBuffer = [];
    }
    
    this.logger.log(`TCP connection ${connectionId} ready`);
  }

  /**
   * Handle TCP data from CLI (response data)
   */
  handleTcpData(connectionId: string, data: string): void {
    const conn = this.tcpConnections.get(connectionId);
    if (!conn) return;
    
    const buffer = Buffer.from(data, 'base64');
    conn.clientSocket.write(buffer);
  }

  /**
   * Handle TCP close from CLI
   */
  handleTcpClose(connectionId: string): void {
    const conn = this.tcpConnections.get(connectionId);
    if (!conn) return;
    
    conn.clientSocket.end();
    this.tcpConnections.delete(connectionId);
  }

  /**
   * Allocate an available port for TCP tunnel
   */
  private async allocatePort(): Promise<number | null> {
    for (let port = TCP_PORT_MIN; port <= TCP_PORT_MAX; port++) {
      if (this.allocatedPorts.has(port)) continue;
      
      // Check if port is actually free
      const isFree = await this.isPortFree(port);
      if (isFree) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    return null;
  }

  /**
   * Check if a port is free
   */
  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Release a port
   */
  private releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Register a WebSocket connection for a tunnel
   */
  registerSocket(tunnelId: string, socket: any): boolean {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) {
      return false;
    }
    
    if (this.isExpired(tunnel)) {
      this.tunnels.delete(tunnelId);
      return false;
    }
    
    tunnel.socket = socket;
    this.logger.log(`Socket registered for tunnel ${tunnelId}`);
    return true;
  }

  /**
   * Unregister socket when disconnected
   */
  unregisterSocket(tunnelId: string): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (tunnel) {
      tunnel.socket = null;
      this.logger.log(`Socket unregistered for tunnel ${tunnelId}`);
    }
  }

  /**
   * Get a tunnel by ID
   */
  getTunnel(tunnelId: string): TemporaryTunnel | null {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return null;
    
    if (this.isExpired(tunnel)) {
      this.tunnels.delete(tunnelId);
      return null;
    }
    
    return tunnel;
  }

  /**
   * Check if tunnel has an active connection
   */
  isConnected(tunnelId: string): boolean {
    const tunnel = this.getTunnel(tunnelId);
    return tunnel?.socket?.connected ?? false;
  }

  /**
   * Forward an HTTP request through the tunnel
   */
  async forwardRequest(
    tunnelId: string,
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body: string;
    },
  ): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const tunnel = this.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new Error('Tunnel not found or expired');
    }
    
    if (!tunnel.socket?.connected) {
      throw new Error('Tunnel not connected');
    }
    
    const requestId = `${tunnelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tunnel.requestCount++;
    
    return new Promise((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      // Send request to CLI via WebSocket
      tunnel.socket.emit('http_request', {
        requestId,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body,
      });
    });
  }

  /**
   * Handle HTTP response from CLI
   */
  handleResponse(requestId: string, response: { status: number; headers: Record<string, string>; body: string }): void {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    return {
      activeTunnels: this.tunnels.size,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Check if tunnel is expired
   */
  private isExpired(tunnel: TemporaryTunnel): boolean {
    return new Date() > tunnel.expiresAt;
  }

  /**
   * Cleanup expired tunnels
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [tunnelId, tunnel] of this.tunnels) {
      if (now > tunnel.expiresAt) {
        // Close TCP server if exists
        if (tunnel.tcpServer) {
          tunnel.tcpServer.close();
        }
        if (tunnel.tcpPort) {
          this.releasePort(tunnel.tcpPort);
        }
        
        // Close any active TCP connections for this tunnel
        for (const [connId, conn] of this.tcpConnections) {
          if (connId.startsWith(tunnelId)) {
            conn.clientSocket.end();
            this.tcpConnections.delete(connId);
          }
        }
        
        if (tunnel.socket) {
          tunnel.socket.emit('tunnel_expired');
          tunnel.socket.disconnect();
        }
        this.tunnels.delete(tunnelId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired tunnels`);
    }
  }

  /**
   * Close a tunnel manually
   */
  closeTunnel(tunnelId: string): void {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) return;
    
    if (tunnel.tcpServer) {
      tunnel.tcpServer.close();
    }
    if (tunnel.tcpPort) {
      this.releasePort(tunnel.tcpPort);
    }
    
    // Close TCP connections
    for (const [connId, conn] of this.tcpConnections) {
      if (connId.startsWith(tunnelId)) {
        conn.clientSocket.end();
        this.tcpConnections.delete(connId);
      }
    }
    
    if (tunnel.socket) {
      tunnel.socket.disconnect();
    }
    this.tunnels.delete(tunnelId);
    this.logger.log(`Tunnel ${tunnelId} closed`);
  }
}
