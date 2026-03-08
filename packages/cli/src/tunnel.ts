/**
 * Private Connect — Programmatic Tunnel API
 *
 * Embed a temporary public tunnel directly in Node.js / Electron / any runtime
 * without spawning a child process or scraping stdout.
 *
 * @example
 * ```typescript
 * import { createTunnel } from 'private-connect';
 *
 * const tunnel = await createTunnel({ port: 3000 });
 * console.log(tunnel.url); // https://abc123.tunnel.privateconnect.co
 *
 * tunnel.on('disconnect', () => console.log('lost connection'));
 * tunnel.on('reconnect', () => console.log('reconnected'));
 *
 * // later...
 * await tunnel.close();
 * ```
 */

import * as net from 'net';
import * as dgram from 'dgram';
import * as http from 'http';
import * as https from 'https';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface TunnelOptions {
  /** Local port to expose */
  port: number;
  /** Local hostname (default: 'localhost') */
  host?: string;
  /** Force raw TCP mode instead of HTTP (auto-detected for DB ports) */
  tcp?: boolean;
  /** Force raw UDP mode */
  udp?: boolean;
  /** Tunnel TTL in minutes (default: 120) */
  ttl?: number;
  /** Override hub URL (default: https://api.privateconnect.co) */
  hubUrl?: string;
  /** AbortSignal to cancel a pending createTunnel() call */
  signal?: AbortSignal;
}

export type TunnelType = 'http' | 'tcp' | 'udp';

export type TunnelEvent = 'disconnect' | 'reconnect' | 'expire' | 'error' | 'url';

export interface TunnelHandle {
  /** Public URL for HTTP tunnels. Updates automatically if the hub reassigns after reconnect. */
  readonly url: string;
  /** Tunnel type determined at creation time */
  readonly type: TunnelType;
  /** ISO timestamp when the tunnel expires */
  readonly expiresAt: string;
  /** TTL in minutes */
  readonly ttlMinutes: number;
  /** For TCP tunnels: the public host to connect to */
  readonly tcpHost?: string;
  /** For TCP tunnels: the public port to connect to */
  readonly tcpPort?: number;
  /** For UDP tunnels: the public host to send datagrams to */
  readonly udpHost?: string;
  /** For UDP tunnels: the public port to send datagrams to */
  readonly udpPort?: number;
  /** Browser-based DB viewer URL (for database port tunnels) */
  readonly webUrl?: string;

  /**
   * Listen for tunnel lifecycle events.
   * - `'disconnect'` — tunnel WebSocket dropped (may reconnect)
   * - `'reconnect'` — tunnel WebSocket re-established
   * - `'expire'`    — tunnel TTL elapsed; close() is called automatically
   * - `'error'`     — non-fatal connection error (string message)
   * - `'url'`       — public URL changed (string new URL); update any stored references
   */
  on(event: TunnelEvent, listener: (detail?: string) => void): this;

  /** Remove a previously registered listener */
  off(event: TunnelEvent, listener: (detail?: string) => void): this;

  /** Cleanly disconnect from the hub and stop forwarding. Resolves once the socket is closed. */
  close(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const DB_PORTS = new Set([5432, 3306, 27017, 6379, 9200, 5984, 8529, 7687, 9042]);

const HUB_REQUEST_TIMEOUT_MS = 10_000;

function httpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error('Aborted'));
    }

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: options.method || 'GET', headers: options.headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ ok: res.statusCode! >= 200 && res.statusCode! < 300, status: res.statusCode!, body }));
    });

    // Actually activate the timeout
    req.setTimeout(HUB_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Request timeout'));
    });

    req.on('error', reject);

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy(new Error('Aborted'));
        reject(new Error('Aborted'));
      }, { once: true });
    }

    if (options.body) req.write(options.body);
    req.end();
  });
}

function forwardHttpToLocal(
  host: string,
  port: number,
  request: { method: string; path: string; headers: Record<string, string>; body: string },
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: request.path,
        method: request.method,
        headers: { ...request.headers, host: `${host}:${port}` },
        timeout: 30000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            headers[k] = Array.isArray(v) ? v.join(', ') : (v ?? '');
          }
          resolve({ status: res.statusCode || 500, headers, body });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    if (request.body) req.write(request.body);
    req.end();
  });
}

function makeSocket(wsUrl: string): Socket {
  const u = new URL(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
  return io(`${u.protocol}//${u.host}${u.pathname || '/temp-tunnel'}`, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy runners
// ─────────────────────────────────────────────────────────────────────────────

function runHttpProxy(
  tunnelId: string,
  wsUrl: string,
  host: string,
  port: number,
  emitter: EventEmitter,
): (onClose: () => void) => void {
  const socket = makeSocket(wsUrl);

  socket.on('connect', () => {
    socket.emit('register', { tunnelId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        emitter.emit('error', `Failed to register tunnel: ${res.error}`);
        socket.disconnect();
      }
    });
  });

  socket.on('disconnect', (reason: string) => {
    emitter.emit('disconnect', reason);
  });

  socket.on('connect_error', (err: Error) => {
    emitter.emit('error', err.message);
  });

  // socket.io v4: reconnect fires on the manager, not the socket
  socket.io.on('reconnect', () => {
    emitter.emit('reconnect');
  });

  socket.on('tunnel_expired', () => {
    emitter.emit('expire');
    socket.disconnect();
  });

  socket.on('server_shutdown', () => {
    emitter.emit('disconnect', 'server_shutdown');
  });

  socket.on('http_request', async (data: {
    requestId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
  }) => {
    try {
      const response = await forwardHttpToLocal(host, port, data);
      socket.emit('http_response', {
        requestId: data.requestId,
        status: response.status,
        headers: response.headers,
        // Send binary body as base64 to preserve binary integrity
        body: response.body.toString('base64'),
        encoding: 'base64',
      });
    } catch (err: any) {
      socket.emit('http_response', {
        requestId: data.requestId,
        status: 502,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ error: 'Bad Gateway', message: err.message })).toString('base64'),
        encoding: 'base64',
      });
    }
  });

  return (onClose: () => void) => {
    socket.once('disconnect', () => onClose());
    socket.disconnect();
  };
}

function runTcpProxy(
  tunnelId: string,
  wsUrl: string,
  host: string,
  port: number,
  emitter: EventEmitter,
): (onClose: () => void) => void {
  const socket = makeSocket(wsUrl);
  const connections = new Map<string, net.Socket>();

  socket.on('connect', () => {
    socket.emit('register', { tunnelId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        emitter.emit('error', `Failed to register tunnel: ${res.error}`);
        socket.disconnect();
      }
    });
  });

  socket.on('disconnect', (reason: string) => {
    for (const conn of connections.values()) conn.end();
    connections.clear();
    emitter.emit('disconnect', reason);
  });

  socket.io.on('reconnect', () => emitter.emit('reconnect'));
  socket.on('connect_error', (err: Error) => emitter.emit('error', err.message));
  socket.on('tunnel_expired', () => { emitter.emit('expire'); socket.disconnect(); });
  socket.on('server_shutdown', () => emitter.emit('disconnect', 'server_shutdown'));

  socket.on('tcp_dial', (data: { connectionId: string }) => {
    const local = net.createConnection({ host, port });
    connections.set(data.connectionId, local);

    local.on('connect', () => socket.emit('tcp_dial_success', { connectionId: data.connectionId }));
    local.on('data', (chunk: Buffer) => socket.emit('tcp_data', { connectionId: data.connectionId, data: chunk.toString('base64') }));
    local.on('close', () => { socket.emit('tcp_close', { connectionId: data.connectionId }); connections.delete(data.connectionId); });
    local.on('error', (err) => { emitter.emit('error', err.message); socket.emit('tcp_close', { connectionId: data.connectionId }); connections.delete(data.connectionId); });
  });

  socket.on('tcp_data', (data: { connectionId: string; data: string }) => {
    connections.get(data.connectionId)?.write(Buffer.from(data.data, 'base64'));
  });

  socket.on('tcp_close', (data: { connectionId: string }) => {
    connections.get(data.connectionId)?.end();
    connections.delete(data.connectionId);
  });

  return (onClose: () => void) => {
    for (const conn of connections.values()) conn.end();
    socket.once('disconnect', () => onClose());
    socket.disconnect();
  };
}

function runUdpProxy(
  tunnelId: string,
  wsUrl: string,
  host: string,
  port: number,
  emitter: EventEmitter,
): (onClose: () => void) => void {
  const socket = makeSocket(wsUrl);
  const udp = dgram.createSocket('udp4');
  const sessions = new Map<string, { address: string; port: number }>();

  socket.on('connect', () => {
    socket.emit('register', { tunnelId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        emitter.emit('error', `Failed to register tunnel: ${res.error}`);
        socket.disconnect();
      }
    });
  });

  socket.on('disconnect', (reason: string) => {
    try { udp.close(); } catch {}
    emitter.emit('disconnect', reason);
  });

  socket.io.on('reconnect', () => emitter.emit('reconnect'));
  socket.on('connect_error', (err: Error) => emitter.emit('error', err.message));
  socket.on('tunnel_expired', () => { emitter.emit('expire'); try { udp.close(); } catch {} socket.disconnect(); });
  socket.on('server_shutdown', () => emitter.emit('disconnect', 'server_shutdown'));

  socket.on('udp_datagram', (data: { sessionId: string; data: string; remoteAddress: string; remotePort: number }) => {
    sessions.set(data.sessionId, { address: data.remoteAddress, port: data.remotePort });
    udp.send(Buffer.from(data.data, 'base64'), port, host);
  });

  udp.on('message', (msg: Buffer) => {
    const last = Array.from(sessions.entries()).pop();
    if (last) socket.emit('udp_response', { sessionId: last[0], data: msg.toString('base64') });
  });

  udp.on('error', (err) => emitter.emit('error', err.message));
  udp.bind();

  return (onClose: () => void) => {
    try { udp.close(); } catch {}
    socket.once('disconnect', () => onClose());
    socket.disconnect();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a temporary public tunnel to a local port.
 *
 * Resolves with a {@link TunnelHandle} once the public URL is ready.
 * Rejects if the hub is unreachable, the request is aborted, or the tunnel
 * cannot be registered.
 *
 * @example
 * ```typescript
 * // HTTP tunnel (default for non-DB ports)
 * const tunnel = await createTunnel({ port: 3000 });
 * console.log(tunnel.url); // https://abc123.tunnel.privateconnect.co
 *
 * // TCP tunnel (auto-detected for Postgres, Redis, etc.)
 * const db = await createTunnel({ port: 5432 });
 * console.log(`${db.tcpHost}:${db.tcpPort}`);
 *
 * // Explicit TCP
 * const t = await createTunnel({ port: 8080, tcp: true });
 *
 * // Cancellable
 * const ac = new AbortController();
 * setTimeout(() => ac.abort(), 5000);
 * const tunnel = await createTunnel({ port: 3000, signal: ac.signal });
 * ```
 */
export async function createTunnel(options: TunnelOptions): Promise<TunnelHandle> {
  const {
    port,
    host = 'localhost',
    udp = false,
    ttl = 120,
    hubUrl = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co',
    signal,
  } = options;

  const isDbPort = DB_PORTS.has(port);
  const tcp = options.tcp ?? (isDbPort && !udp);
  const tunnelType: TunnelType = udp ? 'udp' : tcp ? 'tcp' : 'http';
  const tunnelId = randomBytes(6).toString('hex');

  const response = await httpRequest(`${hubUrl}/v1/tunnels/temporary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tunnelId, localHost: host, localPort: port, ttlMinutes: ttl, type: tunnelType }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to create tunnel: HTTP ${response.status} — ${response.body}`);
  }

  const { tunnel: t } = JSON.parse(response.body) as {
    tunnel: {
      tunnelId: string;
      type: TunnelType;
      publicUrl: string;
      subdomain?: string;
      wsUrl: string;
      expiresAt: string;
      ttlMinutes: number;
      tcpHost?: string;
      tcpPort?: number;
      udpHost?: string;
      udpPort?: number;
      webUrl?: string;
    };
  };

  // For local dev, adjust the WS URL
  let wsUrl = t.wsUrl;
  if (hubUrl.includes('localhost')) {
    wsUrl = hubUrl.replace('http', 'ws') + '/temp-tunnel';
  }

  const emitter = new EventEmitter();

  // Mutable URL — updated if hub reassigns on reconnect
  let currentUrl = t.publicUrl;

  let stopProxy: (onClose: () => void) => void;
  if (tunnelType === 'udp') {
    stopProxy = runUdpProxy(t.tunnelId, wsUrl, host, port, emitter);
  } else if (tunnelType === 'tcp') {
    stopProxy = runTcpProxy(t.tunnelId, wsUrl, host, port, emitter);
  } else {
    stopProxy = runHttpProxy(t.tunnelId, wsUrl, host, port, emitter);
  }

  // If the hub emits a new URL after reconnect, update and notify
  emitter.on('_url_update', (newUrl: string) => {
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      emitter.emit('url', newUrl);
    }
  });

  let closed = false;

  const handle: TunnelHandle = {
    get url() { return currentUrl; },
    type: t.type,
    expiresAt: t.expiresAt,
    ttlMinutes: t.ttlMinutes,
    tcpHost: t.tcpHost,
    tcpPort: t.tcpPort,
    udpHost: t.udpHost,
    udpPort: t.udpPort,
    webUrl: t.webUrl,

    on(event, listener) {
      emitter.on(event, listener);
      return this;
    },

    off(event, listener) {
      emitter.off(event, listener);
      return this;
    },

    close() {
      if (closed) return Promise.resolve();
      closed = true;
      return new Promise<void>((resolve) => {
        stopProxy(() => resolve());
      });
    },
  };

  return handle;
}
