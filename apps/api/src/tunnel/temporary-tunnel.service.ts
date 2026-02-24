import { Injectable, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { SecureLogger } from '../common/security';
import { DebugService } from '../debug/debug.service';
import * as net from 'net';
import * as dgram from 'dgram';
import { randomBytes } from 'crypto';

type TunnelType = 'http' | 'tcp' | 'udp';

interface TemporaryTunnel {
  tunnelId: string;
  type: TunnelType;
  localHost: string;
  localPort: number;
  createdAt: Date;
  expiresAt: Date;
  socket: any | null; // WebSocket connection from CLI
  requestCount: number;
  // Public subdomain for HTTP tunnels
  subdomain?: string;
  // TCP-specific
  tcpPort?: number;
  tcpServer?: net.Server;
  // UDP-specific
  udpPort?: number;
  udpServer?: dgram.Socket;
  udpSessions?: Map<string, { address: string; port: number; timestamp: number }>;
  // Debug session for packet capture (UUID) and widget URL (token)
  debugSessionId?: string;
  debugSessionToken?: string;
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

export interface TunnelBundle {
  code: string;
  tunnels: Array<{ tunnelId: string; localPort: number; tcpPort: number }>;
  createdAt: Date;
  expiresAt: Date;
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
export class TemporaryTunnelService implements OnModuleDestroy {
  private readonly logger = new SecureLogger(TemporaryTunnelService.name);
  private tunnels = new Map<string, TemporaryTunnel>();
  private pendingRequests = new Map<string, PendingRequest>();
  private tcpConnections = new Map<string, TcpConnection>();
  private allocatedPorts = new Set<number>();
  private usedSubdomains = new Set<string>();
  private bundles = new Map<string, TunnelBundle>();
  
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(
    @Inject(forwardRef(() => DebugService))
    private debugService: DebugService,
  ) {
    // Cleanup expired tunnels every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
  }

  /**
   * Graceful shutdown - notify all connected clients before closing
   */
  async onModuleDestroy() {
    this.logger.log('Graceful shutdown initiated - notifying connected tunnels...');
    
    // Clear the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const tunnelCount = this.tunnels.size;
    if (tunnelCount === 0) {
      this.logger.log('No active tunnels to close');
      return;
    }

    this.logger.log(`Notifying ${tunnelCount} connected tunnel(s) of shutdown...`);

    // Notify all connected clients
    for (const [tunnelId, tunnel] of this.tunnels) {
      if (tunnel.socket?.connected) {
        // Send shutdown warning with reason
        tunnel.socket.emit('server_shutdown', {
          reason: 'Server is restarting',
          message: 'The tunnel server is shutting down. Please reconnect shortly.',
          reconnectIn: 5, // Suggest reconnecting in 5 seconds
        });
      }

      // Close TCP server if exists
      if (tunnel.tcpServer) {
        tunnel.tcpServer.close();
      }

      // Close UDP server if exists
      if (tunnel.udpServer) {
        tunnel.udpServer.close();
      }

      // End linked debug session
      if (tunnel.debugSessionId) {
        this.debugService.endSession(tunnel.debugSessionId).catch(() => {});
      }
    }

    // Give clients a moment to receive the message before disconnecting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Now disconnect all sockets
    for (const [tunnelId, tunnel] of this.tunnels) {
      if (tunnel.socket?.connected) {
        tunnel.socket.disconnect();
      }
    }

    // Close all TCP connections
    for (const [connId, conn] of this.tcpConnections) {
      conn.clientSocket.end();
    }

    this.tunnels.clear();
    this.tcpConnections.clear();
    this.allocatedPorts.clear();
    this.usedSubdomains.clear();
    this.bundles.clear();

    this.logger.log(`Graceful shutdown complete - closed ${tunnelCount} tunnel(s)`);
  }

  /**
   * Generate a random subdomain (8 chars, hex)
   */
  private generateSubdomain(): string {
    return randomBytes(4).toString('hex');
  }

  /**
   * Get a unique subdomain
   */
  private getUniqueSubdomain(): string {
    let subdomain: string;
    let attempts = 0;
    do {
      subdomain = this.generateSubdomain();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique subdomain');
      }
    } while (this.usedSubdomains.has(subdomain));
    
    this.usedSubdomains.add(subdomain);
    return subdomain;
  }

  /**
   * Get a unique subdomain with a user-provided prefix (e.g. "stripe" → "stripe-a1b2")
   */
  private getUniqueSubdomainWithPrefix(prefix: string): string {
    // Sanitize: lowercase, alphanumeric + hyphens only, max 20 chars
    const sanitized = prefix.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
    if (!sanitized) return this.getUniqueSubdomain();

    let subdomain: string;
    let attempts = 0;
    do {
      const suffix = randomBytes(2).toString('hex');
      subdomain = `${sanitized}-${suffix}`;
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique subdomain');
      }
    } while (this.usedSubdomains.has(subdomain));

    this.usedSubdomains.add(subdomain);
    return subdomain;
  }

  /**
   * Create a new HTTP temporary tunnel
   */
  createTunnel(tunnelId: string, localHost: string, localPort: number, ttlMinutes: number, slug?: string): TemporaryTunnel {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    // Generate a unique subdomain for public access (with optional slug prefix)
    const subdomain = slug
      ? this.getUniqueSubdomainWithPrefix(slug)
      : this.getUniqueSubdomain();
    
    const tunnel: TemporaryTunnel = {
      tunnelId,
      type: 'http',
      localHost,
      localPort,
      createdAt: now,
      expiresAt,
      socket: null,
      requestCount: 0,
      subdomain,
    };
    
    this.tunnels.set(tunnelId, tunnel);
    this.logger.log(`Created HTTP temporary tunnel ${tunnelId} with subdomain ${subdomain}, expires at ${expiresAt.toISOString()}`);
    
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
   * Create a new UDP temporary tunnel with dynamic port allocation
   */
  async createUdpTunnel(tunnelId: string, localHost: string, localPort: number, ttlMinutes: number): Promise<TemporaryTunnel> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    // Allocate a port (reuse TCP port range for UDP)
    const udpPort = await this.allocatePort();
    if (!udpPort) {
      throw new Error('No available ports for UDP tunnel');
    }
    
    const tunnel: TemporaryTunnel = {
      tunnelId,
      type: 'udp',
      localHost,
      localPort,
      createdAt: now,
      expiresAt,
      socket: null,
      requestCount: 0,
      udpPort,
      udpSessions: new Map(),
    };
    
    this.tunnels.set(tunnelId, tunnel);
    this.logger.log(`Created UDP temporary tunnel ${tunnelId} on port ${udpPort}, expires at ${expiresAt.toISOString()}`);
    
    return tunnel;
  }

  /**
   * Start UDP server for a tunnel (called after CLI connects)
   */
  async startUdpServer(tunnelId: string): Promise<void> {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel || tunnel.type !== 'udp' || !tunnel.udpPort) {
      throw new Error('UDP tunnel not found');
    }
    
    if (tunnel.udpServer) {
      return; // Already running
    }
    
    return new Promise((resolve, reject) => {
      const server = dgram.createSocket('udp4');
      
      server.on('error', (err) => {
        this.logger.error(`UDP server error for tunnel ${tunnelId}: ${err.message}`);
        server.close();
        reject(err);
      });
      
      server.on('message', (msg, rinfo) => {
        this.handleUdpDatagram(tunnelId, msg, rinfo);
      });
      
      server.bind(tunnel.udpPort, '0.0.0.0', () => {
        this.logger.log(`UDP server started for tunnel ${tunnelId} on port ${tunnel.udpPort}`);
        tunnel.udpServer = server;
        resolve();
      });
    });
  }

  /**
   * Handle incoming UDP datagram
   */
  private handleUdpDatagram(tunnelId: string, msg: Buffer, rinfo: dgram.RemoteInfo): void {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel || !tunnel.socket?.connected) {
      this.logger.warn(`UDP datagram rejected: tunnel ${tunnelId} not connected`);
      return;
    }
    
    tunnel.requestCount++;
    
    // Create session ID for tracking responses
    const sessionId = `${rinfo.address}:${rinfo.port}-${Date.now()}`;
    tunnel.udpSessions?.set(sessionId, {
      address: rinfo.address,
      port: rinfo.port,
      timestamp: Date.now(),
    });
    
    this.logger.debug(`UDP datagram from ${rinfo.address}:${rinfo.port} for tunnel ${tunnelId} (${msg.length} bytes)`);
    
    // Forward to CLI
    tunnel.socket.emit('udp_datagram', {
      sessionId,
      data: msg.toString('base64'),
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
    });
  }

  /**
   * Send UDP response back to client
   */
  sendUdpResponseForSession(tunnelId: string, sessionId: string, data: Buffer): boolean {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel || !tunnel.udpServer) {
      this.logger.warn(`Cannot send UDP response: tunnel ${tunnelId} not found or no UDP server`);
      return false;
    }

    const session = tunnel.udpSessions?.get(sessionId);
    if (!session) {
      this.logger.warn(`Cannot send UDP response: session ${sessionId} not found for tunnel ${tunnelId}`);
      return false;
    }

    tunnel.udpServer.send(data, session.port, session.address, (err) => {
      if (err) {
        this.logger.error(`UDP send error for tunnel ${tunnelId}: ${err.message}`);
      }
    });

    return true;
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
      if (tunnel.subdomain) {
        this.usedSubdomains.delete(tunnel.subdomain);
      }
      return null;
    }
    
    return tunnel;
  }

  /**
   * Get a tunnel by subdomain
   */
  getTunnelBySubdomain(subdomain: string): TemporaryTunnel | null {
    for (const tunnel of this.tunnels.values()) {
      if (tunnel.subdomain === subdomain && !this.isExpired(tunnel)) {
        return tunnel;
      }
    }
    return null;
  }

  /**
   * List all active tunnels
   */
  listTunnels(): TemporaryTunnel[] {
    const activeTunnels: TemporaryTunnel[] = [];
    for (const tunnel of this.tunnels.values()) {
      if (!this.isExpired(tunnel)) {
        activeTunnels.push(tunnel);
      }
    }
    return activeTunnels;
  }

  /**
   * Link a debug session to a tunnel for packet capture
   */
  linkDebugSession(tunnelId: string, debugSessionId: string, debugSessionToken?: string): boolean {
    const tunnel = this.getTunnel(tunnelId);
    if (!tunnel) return false;
    
    tunnel.debugSessionId = debugSessionId;
    tunnel.debugSessionToken = debugSessionToken;
    this.logger.log(`Linked debug session ${debugSessionId} to tunnel ${tunnelId}`);
    return true;
  }

  /**
   * Get the debug session ID (UUID) for a tunnel
   */
  getDebugSessionId(tunnelId: string): string | undefined {
    const tunnel = this.getTunnel(tunnelId);
    return tunnel?.debugSessionId;
  }

  /**
   * Get the debug session token (s-xxxxx) for a tunnel (used in widget URLs)
   */
  getDebugSessionToken(tunnelId: string): string | undefined {
    const tunnel = this.getTunnel(tunnelId);
    return tunnel?.debugSessionToken;
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
   * Generate a short, typeable bundle code (6 chars, no ambiguous characters)
   */
  private generateBundleCode(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Create a bundle of TCP tunnels for multi-port sharing.
   * Allocates all tunnels atomically -- rolls back on failure.
   */
  async createBundle(ports: number[], ttlMinutes: number): Promise<TunnelBundle> {
    let code: string;
    let attempts = 0;
    do {
      code = this.generateBundleCode();
      attempts++;
      if (attempts > 10) throw new Error('Failed to generate unique bundle code');
    } while (this.bundles.has(code));

    const tunnels: Array<{ tunnelId: string; localPort: number; tcpPort: number }> = [];
    const createdIds: string[] = [];

    try {
      for (const localPort of ports) {
        const tunnelId = randomBytes(6).toString('hex');
        const tunnel = await this.createTcpTunnel(tunnelId, 'localhost', localPort, ttlMinutes);
        createdIds.push(tunnelId);
        tunnels.push({ tunnelId, localPort, tcpPort: tunnel.tcpPort! });
      }
    } catch (err) {
      for (const id of createdIds) {
        this.closeTunnel(id);
      }
      throw err;
    }

    const now = new Date();
    const bundle: TunnelBundle = {
      code,
      tunnels,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
    };

    this.bundles.set(code, bundle);
    this.logger.log(`Created bundle ${code} with ${tunnels.length} tunnels: ${ports.join(', ')}`);
    return bundle;
  }

  /**
   * Get a bundle by join code
   */
  getBundle(code: string): TunnelBundle | null {
    const bundle = this.bundles.get(code);
    if (!bundle) return null;

    if (new Date() > bundle.expiresAt) {
      this.bundles.delete(code);
      return null;
    }
    return bundle;
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    return {
      activeTunnels: this.tunnels.size,
      activeBundles: this.bundles.size,
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
        
        // Close UDP server if exists
        if (tunnel.udpServer) {
          tunnel.udpServer.close();
        }
        if (tunnel.udpPort) {
          this.releasePort(tunnel.udpPort);
        }
        if (tunnel.udpSessions) {
          tunnel.udpSessions.clear();
        }
        
        // Release subdomain
        if (tunnel.subdomain) {
          this.usedSubdomains.delete(tunnel.subdomain);
        }
        
        // End linked debug session
        if (tunnel.debugSessionId) {
          this.debugService.endSession(tunnel.debugSessionId).catch(err => {
            this.logger.warn(`Failed to end debug session ${tunnel.debugSessionId}: ${err.message}`);
          });
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
    
    // Clean up expired bundles
    for (const [code, bundle] of this.bundles) {
      if (now > bundle.expiresAt) {
        this.bundles.delete(code);
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
    
    if (tunnel.udpServer) {
      tunnel.udpServer.close();
    }
    if (tunnel.udpPort) {
      this.releasePort(tunnel.udpPort);
    }
    if (tunnel.udpSessions) {
      tunnel.udpSessions.clear();
    }
    
    // Release subdomain
    if (tunnel.subdomain) {
      this.usedSubdomains.delete(tunnel.subdomain);
    }
    
    // End linked debug session
    if (tunnel.debugSessionId) {
      this.debugService.endSession(tunnel.debugSessionId).catch(err => {
        this.logger.warn(`Failed to end debug session ${tunnel.debugSessionId}: ${err.message}`);
      });
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
