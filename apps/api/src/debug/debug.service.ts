import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecureLogger } from '../common/security';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export interface CapturedPacket {
  sessionId: string;
  connectionId: string;
  direction: 'inbound' | 'outbound';
  payload: Buffer;
  timestamp: Date;
}

export interface DebugSessionInfo {
  id: string;
  token: string;
  workspaceId: string;
  serviceId?: string;
  agentId?: string;
  status: string;
  aiEnabled: boolean;
  packetCount: number;
  byteCount: bigint;
  createdAt: Date;
}

@Injectable()
export class DebugService {
  private readonly logger = new SecureLogger(DebugService.name);
  
  // Active debug sessions indexed by connection patterns
  private activeSessionsByService = new Map<string, string>(); // serviceId -> sessionId
  private activeSessionsByAgent = new Map<string, Set<string>>(); // agentId -> Set<sessionId>
  private activeSessionsByConnection = new Map<string, string>(); // connectionId -> sessionId
  
  // Packet sequence counters per session
  private packetSequence = new Map<string, number>();
  
  // Event emitter for real-time streaming
  private packetEmitter = new EventEmitter();

  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Create a new debug session
   */
  async createSession(params: {
    workspaceId: string;
    serviceId?: string;
    agentId?: string;
    name?: string;
    aiEnabled?: boolean;
    aiProvider?: string;
    aiModel?: string;
    expiresIn?: number; // minutes, default 60
  }): Promise<DebugSessionInfo> {
    const token = `s-${randomBytes(4).toString('hex')}`;
    const expiresAt = params.expiresIn 
      ? new Date(Date.now() + params.expiresIn * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000); // Default 1 hour

    const session = await this.prisma.debugSession.create({
      data: {
        workspaceId: params.workspaceId,
        serviceId: params.serviceId,
        agentId: params.agentId,
        token,
        name: params.name,
        status: 'active',
        aiEnabled: params.aiEnabled || false,
        aiProvider: params.aiProvider,
        aiModel: params.aiModel,
        expiresAt,
      },
    });

    // Index the session for quick lookup
    if (params.serviceId) {
      this.activeSessionsByService.set(params.serviceId, session.id);
    }
    if (params.agentId) {
      const agentSessions = this.activeSessionsByAgent.get(params.agentId) || new Set();
      agentSessions.add(session.id);
      this.activeSessionsByAgent.set(params.agentId, agentSessions);
    }

    this.packetSequence.set(session.id, 0);
    this.logger.log(`Created debug session ${session.id} (token: ${token})`);

    return {
      id: session.id,
      token: session.token,
      workspaceId: session.workspaceId,
      serviceId: session.serviceId || undefined,
      agentId: session.agentId || undefined,
      status: session.status,
      aiEnabled: session.aiEnabled,
      packetCount: session.packetCount,
      byteCount: session.byteCount,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get session by token (for public access)
   */
  async getSessionByToken(token: string): Promise<DebugSessionInfo | null> {
    const session = await this.prisma.debugSession.findUnique({
      where: { token },
    });

    if (!session) return null;

    // Check if expired
    if (session.expiresAt && session.expiresAt < new Date()) {
      await this.endSession(session.id);
      return null;
    }

    return {
      id: session.id,
      token: session.token,
      workspaceId: session.workspaceId,
      serviceId: session.serviceId || undefined,
      agentId: session.agentId || undefined,
      status: session.status,
      aiEnabled: session.aiEnabled,
      packetCount: session.packetCount,
      byteCount: session.byteCount,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<DebugSessionInfo | null> {
    const session = await this.prisma.debugSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return null;

    return {
      id: session.id,
      token: session.token,
      workspaceId: session.workspaceId,
      serviceId: session.serviceId || undefined,
      agentId: session.agentId || undefined,
      status: session.status,
      aiEnabled: session.aiEnabled,
      packetCount: session.packetCount,
      byteCount: session.byteCount,
      createdAt: session.createdAt,
    };
  }

  /**
   * List sessions for a workspace
   */
  async listSessions(workspaceId: string, includeEnded = false) {
    const where: any = { workspaceId };
    if (!includeEnded) {
      where.status = 'active';
    }

    return this.prisma.debugSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * End a debug session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await this.prisma.debugSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    await this.prisma.debugSession.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    // Clean up indexes
    if (session.serviceId) {
      this.activeSessionsByService.delete(session.serviceId);
    }
    if (session.agentId) {
      const agentSessions = this.activeSessionsByAgent.get(session.agentId);
      if (agentSessions) {
        agentSessions.delete(sessionId);
        if (agentSessions.size === 0) {
          this.activeSessionsByAgent.delete(session.agentId);
        }
      }
    }
    this.packetSequence.delete(sessionId);

    this.logger.log(`Ended debug session ${sessionId}`);
  }

  /**
   * Associate a connection with a debug session
   */
  registerConnection(connectionId: string, sessionId: string): void {
    this.activeSessionsByConnection.set(connectionId, sessionId);
  }

  /**
   * Remove connection association
   */
  unregisterConnection(connectionId: string): void {
    this.activeSessionsByConnection.delete(connectionId);
  }

  /**
   * Find active session for a service
   */
  getSessionForService(serviceId: string): string | undefined {
    return this.activeSessionsByService.get(serviceId);
  }

  /**
   * Find active session for an agent
   * Returns the first active session if there are multiple
   */
  getSessionForAgent(agentId: string): string | undefined {
    const sessions = this.activeSessionsByAgent.get(agentId);
    if (sessions && sessions.size > 0) {
      return sessions.values().next().value;
    }
    return undefined;
  }

  /**
   * Find active sessions for an agent
   */
  getSessionsForAgent(agentId: string): Set<string> | undefined {
    return this.activeSessionsByAgent.get(agentId);
  }

  /**
   * Find session for a connection
   */
  getSessionForConnection(connectionId: string): string | undefined {
    return this.activeSessionsByConnection.get(connectionId);
  }

  /**
   * Capture a packet from tunnel traffic
   */
  async capturePacket(packet: CapturedPacket): Promise<void> {
    const sessionId = packet.sessionId;
    
    // Get next sequence number
    const sequence = (this.packetSequence.get(sessionId) || 0) + 1;
    this.packetSequence.set(sessionId, sequence);

    // Detect protocol
    const protocol = this.detectProtocol(packet.payload);

    // Parse if possible
    const parsed = this.parsePacket(packet.payload, protocol);

    // Store packet
    const dbPacket = await this.prisma.debugPacket.create({
      data: {
        sessionId,
        sequence,
        direction: packet.direction,
        protocol,
        payload: packet.payload.toString('base64'),
        payloadSize: packet.payload.length,
        parsed: parsed ? JSON.stringify(parsed) : null,
        connectionId: packet.connectionId,
      },
    });

    // Update session stats
    await this.prisma.debugSession.update({
      where: { id: sessionId },
      data: {
        packetCount: { increment: 1 },
        byteCount: { increment: packet.payload.length },
      },
    });

    // Emit for real-time streaming
    this.packetEmitter.emit(`packet:${sessionId}`, {
      id: dbPacket.id,
      sequence,
      direction: packet.direction,
      protocol,
      payloadSize: packet.payload.length,
      parsed,
      connectionId: packet.connectionId,
      capturedAt: dbPacket.capturedAt,
      // Include raw payload for small packets, truncate for large ones
      payload: packet.payload.length <= 10240 
        ? packet.payload.toString('base64') 
        : undefined,
    });
  }

  /**
   * Subscribe to packet stream for a session
   */
  onPacket(sessionId: string, callback: (packet: any) => void): () => void {
    const eventName = `packet:${sessionId}`;
    this.packetEmitter.on(eventName, callback);
    return () => this.packetEmitter.off(eventName, callback);
  }

  /**
   * Get recent packets for a session
   */
  async getPackets(sessionId: string, limit = 100, before?: string) {
    const where: any = { sessionId };
    if (before) {
      const beforePacket = await this.prisma.debugPacket.findUnique({
        where: { id: before },
        select: { sequence: true },
      });
      if (beforePacket) {
        where.sequence = { lt: beforePacket.sequence };
      }
    }

    return this.prisma.debugPacket.findMany({
      where,
      orderBy: { sequence: 'desc' },
      take: limit,
    });
  }

  /**
   * Get a single packet with full payload
   */
  async getPacket(packetId: string) {
    return this.prisma.debugPacket.findUnique({
      where: { id: packetId },
    });
  }

  /**
   * Detect protocol from packet payload
   */
  private detectProtocol(payload: Buffer): string {
    if (payload.length === 0) return 'unknown';

    const str = payload.toString('utf8', 0, Math.min(payload.length, 100));

    // HTTP detection
    if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s/.test(str)) {
      return 'http';
    }
    if (/^HTTP\/\d\.\d\s/.test(str)) {
      return 'http';
    }

    // PostgreSQL wire protocol
    // Startup message starts with length (4 bytes) + protocol version (4 bytes)
    if (payload.length >= 8) {
      const possibleVersion = payload.readInt32BE(4);
      if (possibleVersion === 196608) { // 3.0 protocol
        return 'postgres';
      }
    }
    // Simple query starts with 'Q' (0x51)
    if (payload[0] === 0x51 || payload[0] === 0x50) {
      return 'postgres';
    }
    // Ready for query 'Z', Row description 'T', Data row 'D'
    if ([0x5A, 0x54, 0x44, 0x43, 0x45].includes(payload[0])) {
      return 'postgres';
    }

    // Redis RESP protocol
    if (payload[0] === 0x2A || payload[0] === 0x2B || payload[0] === 0x2D || 
        payload[0] === 0x3A || payload[0] === 0x24) {
      // *, +, -, :, $
      return 'redis';
    }

    // MySQL protocol
    if (payload.length >= 5 && payload[4] === 0x0A) {
      return 'mysql';
    }

    // gRPC detection (HTTP/2 with application/grpc content-type)
    // gRPC uses HTTP/2 frames, look for common patterns
    if (payload.length >= 9) {
      // HTTP/2 connection preface
      const preface = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';
      if (str.startsWith(preface.substring(0, 10))) {
        return 'grpc';
      }
      // HTTP/2 frame header (9 bytes): length(3) + type(1) + flags(1) + stream(4)
      // DATA frame type = 0x00, HEADERS = 0x01
      if (payload[3] <= 0x09 && payload[4] <= 0xFF) {
        // Check if content-type header contains grpc
        if (str.toLowerCase().includes('application/grpc')) {
          return 'grpc';
        }
      }
    }

    // GraphQL detection (look for query/mutation in HTTP body)
    // This is checked after HTTP, so we look for GraphQL patterns in the body
    if (str.includes('"query"') && (str.includes('query') || str.includes('mutation') || str.includes('subscription'))) {
      return 'graphql';
    }
    if (str.includes('{"data":') || str.includes('"errors":[')) {
      return 'graphql';
    }

    return 'unknown';
  }

  /**
   * Parse packet based on detected protocol
   */
  private parsePacket(payload: Buffer, protocol: string): any {
    try {
      switch (protocol) {
        case 'http':
          return this.parseHttp(payload);
        case 'postgres':
          return this.parsePostgres(payload);
        case 'redis':
          return this.parseRedis(payload);
        case 'graphql':
          return this.parseGraphQL(payload);
        case 'grpc':
          return this.parseGrpc(payload);
        default:
          return null;
      }
    } catch (err) {
      this.logger.debug(`Failed to parse ${protocol} packet: ${err}`);
      return null;
    }
  }

  /**
   * Parse HTTP request/response
   */
  private parseHttp(payload: Buffer): any {
    const str = payload.toString('utf8');
    const headerEnd = str.indexOf('\r\n\r\n');
    if (headerEnd === -1) return null;

    const headerSection = str.substring(0, headerEnd);
    const lines = headerSection.split('\r\n');
    const firstLine = lines[0];

    const headers: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const colonIndex = lines[i].indexOf(':');
      if (colonIndex !== -1) {
        const key = lines[i].substring(0, colonIndex).trim().toLowerCase();
        const value = lines[i].substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    // Check if request or response
    if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/.test(firstLine)) {
      const parts = firstLine.split(' ');
      return {
        type: 'request',
        method: parts[0],
        path: parts[1],
        version: parts[2],
        headers,
        bodyPreview: str.substring(headerEnd + 4, headerEnd + 4 + 500),
      };
    } else if (/^HTTP\//.test(firstLine)) {
      const parts = firstLine.split(' ');
      return {
        type: 'response',
        version: parts[0],
        status: parseInt(parts[1]),
        statusText: parts.slice(2).join(' '),
        headers,
        bodyPreview: str.substring(headerEnd + 4, headerEnd + 4 + 500),
      };
    }

    return null;
  }

  /**
   * Parse PostgreSQL wire protocol (simplified)
   */
  private parsePostgres(payload: Buffer): any {
    if (payload.length < 5) return null;

    const messageType = String.fromCharCode(payload[0]);
    const length = payload.readInt32BE(1);

    switch (messageType) {
      case 'Q': // Simple Query
        return {
          type: 'query',
          query: payload.toString('utf8', 5, Math.min(length, 1000)),
        };
      case 'P': // Parse (prepared statement)
        return {
          type: 'parse',
          preview: payload.toString('utf8', 5, Math.min(length, 200)),
        };
      case 'E': // Error
        return {
          type: 'error',
          preview: payload.toString('utf8', 5, Math.min(length, 500)),
        };
      case 'Z': // Ready for query
        return {
          type: 'ready',
          transactionStatus: String.fromCharCode(payload[5]),
        };
      case 'T': // Row description
        return {
          type: 'row_description',
        };
      case 'D': // Data row
        return {
          type: 'data_row',
        };
      case 'C': // Command complete
        return {
          type: 'command_complete',
          tag: payload.toString('utf8', 5, length - 1),
        };
      default:
        return {
          type: 'unknown',
          messageType,
        };
    }
  }

  /**
   * Parse Redis RESP protocol (simplified)
   */
  private parseRedis(payload: Buffer): any {
    const str = payload.toString('utf8');
    const lines = str.split('\r\n');
    
    if (lines.length === 0) return null;

    const first = lines[0];
    const type = first[0];

    switch (type) {
      case '*': // Array (commands)
        const count = parseInt(first.substring(1));
        const args: string[] = [];
        for (let i = 1; i < lines.length && args.length < count; i += 2) {
          if (lines[i + 1]) {
            args.push(lines[i + 1]);
          }
        }
        return {
          type: 'command',
          command: args[0]?.toUpperCase(),
          args: args.slice(1, 5), // Limit args preview
        };
      case '+': // Simple string
        return { type: 'simple_string', value: first.substring(1) };
      case '-': // Error
        return { type: 'error', message: first.substring(1) };
      case ':': // Integer
        return { type: 'integer', value: parseInt(first.substring(1)) };
      case '$': // Bulk string
        return { type: 'bulk_string', length: parseInt(first.substring(1)) };
      default:
        return null;
    }
  }

  /**
   * Parse GraphQL request/response
   */
  private parseGraphQL(payload: Buffer): any {
    const str = payload.toString('utf8');
    
    // Try to extract JSON body from HTTP request/response
    const bodyStart = str.indexOf('\r\n\r\n');
    const body = bodyStart !== -1 ? str.substring(bodyStart + 4) : str;
    
    try {
      const json = JSON.parse(body);
      
      // GraphQL request
      if (json.query) {
        const operationType = this.detectGraphQLOperation(json.query);
        const operationName = json.operationName || this.extractOperationName(json.query);
        
        return {
          type: 'request',
          operationType,
          operationName,
          query: json.query.substring(0, 500),
          variables: json.variables ? Object.keys(json.variables).slice(0, 10) : [],
        };
      }
      
      // GraphQL response
      if (json.data !== undefined || json.errors) {
        return {
          type: 'response',
          hasData: json.data !== undefined,
          hasErrors: Array.isArray(json.errors) && json.errors.length > 0,
          errors: json.errors?.slice(0, 3)?.map((e: any) => e.message) || [],
          dataFields: json.data ? Object.keys(json.data).slice(0, 10) : [],
        };
      }
    } catch (err) {
      // Not valid JSON, try regex extraction
      const queryMatch = str.match(/"query"\s*:\s*"([^"]+)"/);
      if (queryMatch) {
        return {
          type: 'request',
          operationType: this.detectGraphQLOperation(queryMatch[1]),
          query: queryMatch[1].substring(0, 200),
        };
      }
    }
    
    return null;
  }

  private detectGraphQLOperation(query: string): string {
    if (/^\s*mutation\b/i.test(query) || /\bmutation\s*[\({]/i.test(query)) {
      return 'mutation';
    }
    if (/^\s*subscription\b/i.test(query) || /\bsubscription\s*[\({]/i.test(query)) {
      return 'subscription';
    }
    return 'query';
  }

  private extractOperationName(query: string): string | null {
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/i);
    return match ? match[1] : null;
  }

  /**
   * Parse gRPC messages (simplified - focuses on HTTP/2 frames)
   */
  private parseGrpc(payload: Buffer): any {
    const str = payload.toString('utf8');
    
    // Extract path from HEADERS frame for RPC method
    const pathMatch = str.match(/:path:\s*([^\r\n]+)/i) || str.match(/path\s*([^\r\n\0]+)/i);
    const methodMatch = pathMatch?.[1]?.match(/\/([^\/]+)\/([^\/\s\0]+)/);
    
    // Extract grpc-status from trailers
    const statusMatch = str.match(/grpc-status:\s*(\d+)/i);
    const messageMatch = str.match(/grpc-message:\s*([^\r\n]+)/i);
    
    // Detect content-type
    const contentTypeMatch = str.match(/content-type:\s*([^\r\n]+)/i);
    const isGrpcWeb = contentTypeMatch?.[1]?.includes('grpc-web');
    
    // Try to detect if request or response
    const isRequest = str.includes(':method:') || str.toLowerCase().includes(':method');
    
    if (methodMatch) {
      return {
        type: isRequest ? 'request' : 'response',
        service: methodMatch[1],
        method: methodMatch[2],
        status: statusMatch ? parseInt(statusMatch[1]) : undefined,
        statusMessage: messageMatch?.[1],
        encoding: isGrpcWeb ? 'grpc-web' : 'grpc',
      };
    }
    
    // Generic gRPC frame info
    if (payload.length >= 9) {
      const frameLength = (payload[0] << 16) | (payload[1] << 8) | payload[2];
      const frameType = payload[3];
      const frameTypes: Record<number, string> = {
        0x00: 'DATA',
        0x01: 'HEADERS',
        0x02: 'PRIORITY',
        0x03: 'RST_STREAM',
        0x04: 'SETTINGS',
        0x05: 'PUSH_PROMISE',
        0x06: 'PING',
        0x07: 'GOAWAY',
        0x08: 'WINDOW_UPDATE',
        0x09: 'CONTINUATION',
      };
      
      return {
        type: 'frame',
        frameType: frameTypes[frameType] || `0x${frameType.toString(16)}`,
        frameLength,
        status: statusMatch ? parseInt(statusMatch[1]) : undefined,
      };
    }
    
    return {
      type: 'unknown',
      encoding: isGrpcWeb ? 'grpc-web' : 'grpc',
    };
  }
}
