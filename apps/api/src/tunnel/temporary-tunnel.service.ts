import { Injectable } from '@nestjs/common';
import { SecureLogger } from '../common/security';

interface TemporaryTunnel {
  tunnelId: string;
  localHost: string;
  localPort: number;
  createdAt: Date;
  expiresAt: Date;
  socket: any | null; // WebSocket connection from CLI
  requestCount: number;
}

interface PendingRequest {
  resolve: (response: { status: number; headers: Record<string, string>; body: string }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Service for managing temporary tunnels (no auth required)
 * Tunnels auto-expire after TTL
 */
@Injectable()
export class TemporaryTunnelService {
  private readonly logger = new SecureLogger(TemporaryTunnelService.name);
  private tunnels = new Map<string, TemporaryTunnel>();
  private pendingRequests = new Map<string, PendingRequest>();
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Cleanup expired tunnels every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
  }

  /**
   * Create a new temporary tunnel
   */
  createTunnel(tunnelId: string, localHost: string, localPort: number, ttlMinutes: number): TemporaryTunnel {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    const tunnel: TemporaryTunnel = {
      tunnelId,
      localHost,
      localPort,
      createdAt: now,
      expiresAt,
      socket: null,
      requestCount: 0,
    };
    
    this.tunnels.set(tunnelId, tunnel);
    this.logger.log(`Created temporary tunnel ${tunnelId}, expires at ${expiresAt.toISOString()}`);
    
    return tunnel;
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
}
