import { Controller, All, Req, Res, Param, Inject, forwardRef } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServicesService } from '../services/services.service';
import { TemporaryTunnelService } from '../tunnel/temporary-tunnel.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { DebugService } from '../debug/debug.service';
import { GrantsService } from '../grants/grants.service';
import { PrismaService } from '../prisma/prisma.service';
import { proxyRateLimiter, proxySubdomainLimiter } from '../common/rate-limiter';
import { 
  resilientRequest, 
  classifyNetworkError, 
  NetworkErrorType,
  NETWORK_CONFIG,
} from '../common/network';
import { SecureLogger } from '../common/security';

// Security limits - packet capture enabled
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PATH_LENGTH = 2048;
const MAX_HEADER_SIZE = 8192;

// Proxy-specific timeouts
const PROXY_CONNECT_TIMEOUT_MS = 10000;
const PROXY_REQUEST_TIMEOUT_MS = 30000;

/**
 * Generate the Private Connect floating widget HTML
 * Injected into HTML responses for temporary tunnels
 */
function generateTunnelWidget(subdomain: string, debugSessionId?: string): string {
  const inspectorUrl = debugSessionId 
    ? `https://app.privateconnect.co/debug/${debugSessionId}` 
    : 'https://privateconnect.co';
  
  return `
<!-- Private Connect Tunnel Widget -->
<div id="pc-tunnel-widget" style="
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 9999px;
  border: 1px solid rgba(107, 114, 128, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12px;
">
  <div style="display: flex; align-items: center; gap: 8px;">
    <div style="width: 8px; height: 8px; border-radius: 50%; background: #6ee7b7; animation: pc-pulse 2s infinite;"></div>
    <span style="color: #d1d5db;">${subdomain}</span>
  </div>
  <div style="width: 1px; height: 16px; background: rgba(107, 114, 128, 0.3);"></div>
  <a href="${inspectorUrl}" target="_blank" style="color: #93c5fd; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#bfdbfe'" onmouseout="this.style.color='#93c5fd'">
    Inspector
  </a>
  <div style="width: 1px; height: 16px; background: rgba(107, 114, 128, 0.3);"></div>
  <a href="https://privateconnect.co" target="_blank" style="color: #6b7280; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#9ca3af'" onmouseout="this.style.color='#6b7280'">
    Private Connect
  </a>
  <button onclick="this.parentElement.remove()" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6b7280'">
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
<style>
  @keyframes pc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
<!-- End Private Connect Tunnel Widget -->
`;
}

/**
 * Inject widget into HTML response body
 */
function injectWidgetIntoHtml(body: string, widget: string): string {
  // Try to inject before </body>
  if (body.includes('</body>')) {
    return body.replace('</body>', widget + '</body>');
  }
  // Try to inject before </html>
  if (body.includes('</html>')) {
    return body.replace('</html>', widget + '</html>');
  }
  // Fallback: append to end
  return body + widget;
}

@Controller()
export class ProxyController {
  private readonly logger = new SecureLogger('ProxyController');

  constructor(
    @Inject(forwardRef(() => ServicesService))
    private servicesService: ServicesService,
    @Inject(forwardRef(() => TemporaryTunnelService))
    private tempTunnelService: TemporaryTunnelService,
    @Inject(forwardRef(() => TunnelService))
    private tunnelService: TunnelService,
    @Inject(forwardRef(() => DebugService))
    private debugService: DebugService,
    @Inject(forwardRef(() => GrantsService))
    private grantsService: GrantsService,
    private prisma: PrismaService,
  ) {}

  // ─── Grant-based proxy: /g/:resource/* ───────────────────────────────────────
  // AI agents use grant tokens to access private resources via this path.

  @All('grant/:resource')
  async grantProxyRoot(
    @Param('resource') resource: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleGrantProxy(resource, '', req, res);
  }

  @All('grant/:resource/*')
  async grantProxyPath(
    @Param('resource') resource: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fullPath = req.path;
    const prefixLength = `/grant/${resource}`.length;
    const targetPath = fullPath.substring(prefixLength) || '/';
    return this.handleGrantProxy(resource, targetPath, req, res);
  }

  private async handleGrantProxy(
    resource: string,
    targetPath: string,
    req: Request,
    res: Response,
  ) {
    // Extract grant token from Authorization header or query param
    const authHeader = req.headers['authorization'];
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const tokenFromQuery = req.query['token'] as string | undefined;
    const grantToken = tokenFromHeader || tokenFromQuery;

    if (!grantToken) {
      return res.status(401).json({
        error: 'Grant token required',
        message: 'Provide a grant token via Authorization: Bearer <token> or ?token=<token>',
      });
    }

    const grant = await this.grantsService.validateGrantToken(grantToken);

    if (!grant) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Grant invalid, expired, or revoked. Run `connect grant ...` to create a new one.',
      });
    }

    if (grant.resourceName !== resource) {
      return res.status(403).json({
        error: 'Resource mismatch',
        message: `This grant is for "${grant.resourceName}", not "${resource}".`,
      });
    }

    if (!grant.service) {
      return res.status(404).json({
        error: 'Service not found',
        message: `No service is mapped to resource "${resource}". Expose it first with: connect expose ... --name ${resource}`,
      });
    }

    if (!grant.service.agentId || !this.tunnelService.isAgentConnected(grant.service.agentId)) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'The agent exposing this service is currently offline.',
      });
    }

    // Enforce read-only scope for HTTP (block mutating methods)
    if (grant.scope === 'read-only') {
      const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
      if (!readOnlyMethods.includes(req.method.toUpperCase())) {
        return res.status(403).json({
          error: 'Read-only grant',
          message: `This grant is read-only. ${req.method} is not allowed.`,
        });
      }
    }

    // Proxy to the service (same as public proxy path)
    try {
      const requestBody = await this.getRequestBody(req);
      const queryString = req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?').replace(/[&?]token=[^&]*/, '') : '';
      const requestPath = (targetPath || '/') + queryString;
      const requestHeaders = this.filterHeaders(req.headers as Record<string, string>);

      const response = await this.tunnelService.forwardHttpRequest(
        grant.service.agentId,
        grant.service.id,
        {
          method: req.method,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody,
        },
      );

      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

      res.setHeader('X-Grant-Agent', grant.agentLabel);
      res.setHeader('X-Grant-Scope', grant.scope);
      res.setHeader('X-Grant-Expires', grant.expiresAt.toISOString());

      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        res.status(response.status).send(response.body.toString('utf-8'));
      } else {
        res.status(response.status).send(response.body);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Grant proxy error for ${resource}: ${err.message}`);

      if (err.message === 'Agent not connected') {
        return res.status(503).json({ error: 'Service unavailable', message: 'Agent is offline.' });
      } else if (err.message === 'Request timeout') {
        return res.status(504).json({ error: 'Gateway timeout', message: 'Service did not respond in time.' });
      } else {
        return res.status(502).json({ error: 'Bad gateway', message: 'Failed to forward request.' });
      }
    }
  }

  // ─── Public subdomain proxy: /w/abc123/* ────────────────────────────────────

  // Handle requests like: /w/abc123/* -> forward to service with subdomain "abc123"
  @All('w/:subdomain')
  async proxyRequestRoot(
    @Param('subdomain') subdomain: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleProxy(subdomain, '', req, res);
  }

  @All('w/:subdomain/*')
  async proxyRequestPath(
    @Param('subdomain') subdomain: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Extract the path after /w/{subdomain}/
    const fullPath = req.path;
    const prefixLength = `/w/${subdomain}`.length;
    const targetPath = fullPath.substring(prefixLength) || '/';
    
    return this.handleProxy(subdomain, targetPath, req, res);
  }

  private async handleProxy(
    subdomain: string,
    targetPath: string,
    req: Request,
    res: Response,
  ) {
    // Get client IP
    const clientIp = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';

    // Rate limit by IP
    if (!proxyRateLimiter.isAllowed(clientIp)) {
      res.setHeader('Retry-After', proxyRateLimiter.getResetTime(clientIp).toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please slow down.',
        retryAfter: proxyRateLimiter.getResetTime(clientIp),
      });
    }

    // Rate limit by subdomain
    if (!proxySubdomainLimiter.isAllowed(subdomain)) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'This service is receiving too many requests.',
        retryAfter: proxySubdomainLimiter.getResetTime(subdomain),
      });
    }

    // Validate path length
    if (targetPath.length > MAX_PATH_LENGTH) {
      return res.status(414).json({
        error: 'URI too long',
        message: `Path exceeds maximum length of ${MAX_PATH_LENGTH} characters`,
      });
    }

    // First check for temporary tunnel by subdomain
    const tempTunnel = this.tempTunnelService.getTunnelBySubdomain(subdomain);
    
    if (tempTunnel) {
      // Handle temporary tunnel
      if (!tempTunnel.socket?.connected) {
        // Show landing page for browser requests when disconnected, JSON for API clients
        const acceptHeader = req.headers['accept'] || '';
        const isBrowserRequest = acceptHeader.includes('text/html');
        if (isBrowserRequest) {
          return this.serveTunnelLandingPage(res, subdomain, tempTunnel);
        }
        return res.status(503).json({ 
          error: 'Tunnel disconnected',
          message: 'The tunnel client is not connected',
        });
      }

      // Get debug session if linked (UUID for packet capture, token for widget URL)
      const debugSessionId = this.tempTunnelService.getDebugSessionId(tempTunnel.tunnelId);
      const debugSessionToken = this.tempTunnelService.getDebugSessionToken(tempTunnel.tunnelId);
      const connectionId = `${tempTunnel.tunnelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Forward request through temporary tunnel
      try {
        const requestBody = await this.getRequestBody(req);
        const requestPath = targetPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
        const requestHeaders = this.filterHeaders(req.headers as Record<string, string>);
        
        // Capture inbound request packet (use temp workspace context for RLS)
        if (debugSessionId) {
          const requestPayload = this.buildHttpRequestPayload(req.method, requestPath, requestHeaders, requestBody);
          this.prisma.withWorkspace('temp-tunnel-workspace', () =>
            this.debugService.capturePacket({
              sessionId: debugSessionId,
              connectionId,
              direction: 'inbound',
              payload: Buffer.from(requestPayload),
              timestamp: new Date(),
            })
          ).catch(err => this.logger.warn(`Failed to capture request packet: ${err.message}`));
        }

        const response = await this.tempTunnelService.forwardRequest(tempTunnel.tunnelId, {
          method: req.method,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody,
        });
        
        // Capture outbound response packet (use temp workspace context for RLS)
        if (debugSessionId) {
          const responsePayload = this.buildHttpResponsePayload(response.status, response.headers, response.body);
          this.prisma.withWorkspace('temp-tunnel-workspace', () =>
            this.debugService.capturePacket({
              sessionId: debugSessionId,
              connectionId,
              direction: 'outbound',
              payload: Buffer.from(responsePayload),
              timestamp: new Date(),
            })
          ).catch(err => this.logger.warn(`Failed to capture response packet: ${err.message}`));
        }

        // Set response headers
        for (const [key, value] of Object.entries(response.headers)) {
          if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        }
        
        res.setHeader('X-RateLimit-Remaining', proxyRateLimiter.getRemaining(clientIp).toString());
        
        // Inject widget into HTML responses (use token for the public debug URL)
        const contentType = response.headers['content-type'] || '';
        let responseBody = response.body;
        
        if (contentType.includes('text/html') && typeof responseBody === 'string') {
          const widget = generateTunnelWidget(subdomain, debugSessionToken);
          responseBody = injectWidgetIntoHtml(responseBody, widget);
        }
        
        res.status(response.status).send(responseBody);
        return;
      } catch (err: any) {
        // Check for body size limit error
        if (err.message?.includes('exceeds maximum size')) {
          return res.status(413).json({
            error: 'Payload too large',
            message: err.message,
          });
        }

        this.logger.error(`Temporary tunnel proxy error for ${subdomain}: ${err.message}`);
        return res.status(502).json({ 
          error: 'Bad gateway',
          message: 'Failed to forward request through tunnel',
        });
      }
    }

    // Fall back to regular service lookup
    const service = await this.servicesService.findBySubdomain(subdomain);
    
    if (!service) {
      return res.status(404).json({ 
        error: 'Service not found',
        message: `No service found for: ${subdomain}`,
      });
    }

    if (!service.isPublic) {
      return res.status(403).json({ 
        error: 'Service not public',
        message: 'This service is not publicly accessible',
      });
    }

    if (!service.agentId || !this.tunnelService.isAgentConnected(service.agentId)) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'The agent exposing this service is currently offline',
      });
    }

    // Forward request through the agent's WebSocket connection
    try {
      const requestBody = await this.getRequestBody(req);
      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      const requestPath = (targetPath || '/') + queryString;
      const requestHeaders = this.filterHeaders(req.headers as Record<string, string>);

      const response = await this.tunnelService.forwardHttpRequest(
        service.agentId,
        service.id,
        {
          method: req.method,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody,
        },
      );
      
      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      
      res.setHeader('X-RateLimit-Remaining', proxyRateLimiter.getRemaining(clientIp).toString());
      
      // For HTML responses, inject widget; for binary, send Buffer directly
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        res.status(response.status).send(response.body.toString('utf-8'));
      } else {
        res.status(response.status).send(response.body);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Proxy error for ${subdomain}: ${err.message}`);
      
      if (err.message === 'Agent not connected') {
        return res.status(503).json({ 
          error: 'Service unavailable',
          message: 'The agent exposing this service is currently offline',
        });
      } else if (err.message === 'Request timeout') {
        return res.status(504).json({ 
          error: 'Gateway timeout',
          message: 'The service did not respond in time.',
        });
      } else {
        return res.status(502).json({ 
          error: 'Bad gateway',
          message: 'Failed to forward request to the service.',
        });
      }
    }
  }

  private async forwardRequest(
    tunnelPort: number,
    targetPath: string,
    req: Request,
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    // Build the target URL (through the tunnel)
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const path = `${targetPath || '/'}${queryString}`;
    
    // Collect request body with size limit
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        throw new Error(`Request body exceeds maximum size of ${MAX_BODY_SIZE / 1024 / 1024}MB`);
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Use resilient request with timeout and retry logic
    const response = await resilientRequest({
      hostname: 'localhost',
      port: tunnelPort,
      path,
      method: req.method,
      headers: this.filterHeaders(req.headers as Record<string, string>),
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      timeoutMs: PROXY_REQUEST_TIMEOUT_MS,
      useHttps: false, // Tunnel is local, always HTTP
      maxRetries: 1, // Single retry for proxy requests
    });

    // Convert headers from http.IncomingHttpHeaders to Record<string, string>
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    }

    return {
      status: response.statusCode,
      headers,
      body: response.body,
    };
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};
    const skipHeaders = ['host', 'connection', 'keep-alive', 'transfer-encoding'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (value && !skipHeaders.includes(key.toLowerCase())) {
        filtered[key] = String(value);
      }
    }
    
    return filtered;
  }

  private async getRequestBody(req: Request): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      req.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          reject(new Error(`Request body exceeds maximum size of ${MAX_BODY_SIZE / 1024 / 1024}MB`));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });

      req.on('error', (err) => reject(err));
    });
  }

  /**
   * Build HTTP request payload for packet capture
   */
  private buildHttpRequestPayload(
    method: string,
    path: string,
    headers: Record<string, string>,
    body: string,
  ): string {
    let payload = `${method} ${path || '/'} HTTP/1.1\r\n`;
    for (const [key, value] of Object.entries(headers)) {
      payload += `${key}: ${value}\r\n`;
    }
    payload += '\r\n';
    if (body) {
      payload += body;
    }
    return payload;
  }

  /**
   * Build HTTP response payload for packet capture
   */
  private buildHttpResponsePayload(
    status: number,
    headers: Record<string, string>,
    body: string,
  ): string {
    const statusText = this.getStatusText(status);
    let payload = `HTTP/1.1 ${status} ${statusText}\r\n`;
    for (const [key, value] of Object.entries(headers)) {
      payload += `${key}: ${value}\r\n`;
    }
    payload += '\r\n';
    if (body) {
      payload += body;
    }
    return payload;
  }

  /**
   * Get HTTP status text
   */
  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return statusTexts[status] || 'Unknown';
  }

  /**
   * Serve a landing page for browser requests to temporary tunnels
   */
  private serveTunnelLandingPage(
    res: Response,
    subdomain: string,
    tunnel: { tunnelId: string; localHost: string; localPort: number; expiresAt: Date; socket?: { connected: boolean } },
  ) {
    const isConnected = tunnel.socket?.connected ?? false;
    const expiresIn = Math.max(0, Math.round((tunnel.expiresAt.getTime() - Date.now()) / 60000));
    const publicUrl = process.env.PUBLIC_URL_BASE || 'https://app.privateconnect.co';
    const fullUrl = `${publicUrl}/w/${subdomain}`;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Connect Tunnel</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      -webkit-font-smoothing: antialiased;
    }
    .radial-gradient {
      position: absolute;
      top: 0;
      right: 56px;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    main { position: relative; z-index: 1; max-width: 420px; }
    .header { margin-bottom: 24px; }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .logo-icon {
      width: 16px;
      height: 16px;
      color: #fff;
    }
    .logo-text { font-size: 20px; font-weight: 500; }
    .subtitle { color: #9ca3af; font-size: 14px; margin-bottom: 12px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 20px;
    }
    .status-badge.connected {
      background: rgba(110, 231, 183, 0.1);
      border: 1px solid rgba(110, 231, 183, 0.15);
      color: #6ee7b7;
    }
    .status-badge.disconnected {
      background: rgba(252, 165, 165, 0.1);
      border: 1px solid rgba(252, 165, 165, 0.15);
      color: #fca5a5;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .status-badge.connected .status-dot { background: #6ee7b7; animation: pulse 2s infinite; }
    .status-badge.disconnected .status-dot { background: #fca5a5; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .steps { list-style: none; font-size: 14px; }
    .step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .step-num {
      width: 20px;
      height: 20px;
      margin-right: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(128, 128, 128, 0.1);
      border-radius: 6px;
      font-size: 11px;
      color: #9ca3af;
      flex-shrink: 0;
    }
    .step-content { flex: 1; }
    .step-label { color: #9ca3af; font-size: 12px; margin-bottom: 4px; }
    .step-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #93c5fd;
      word-break: break-all;
    }
    .step-value.white { color: #fff; }
    .code-block {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(128, 128, 128, 0.1);
      border-radius: 8px;
      padding: 12px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #d1d5db;
      margin-top: 8px;
      overflow-x: auto;
    }
    .code-block .prompt { color: #6b7280; }
    .code-block .cmd { color: #93c5fd; }
    .footer {
      margin-top: 32px;
    }
    .footer a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #6b7280;
      text-decoration: none;
      font-size: 14px;
      transition: color 0.15s;
    }
    .footer a:hover { color: #fff; }
    .footer svg { width: 16px; height: 16px; }
    .expires {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .expires svg { width: 14px; height: 14px; }
  </style>
</head>
<body>
  <div class="radial-gradient"></div>
  <main>
    <header class="header">
      <div class="logo-row">
        <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.638 1.093a.75.75 0 0 1 .724 0l2 1.104a.75.75 0 1 1-.724 1.313L10 2.607l-1.638.903a.75.75 0 1 1-.724-1.313l2-1.104ZM5.403 4.287a.75.75 0 0 1-.295 1.019l-.805.444.805.444a.75.75 0 0 1-.724 1.314L3.5 7.02v.73a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 1 .388-.657l1.996-1.1a.75.75 0 0 1 1.019.294Zm9.194 0a.75.75 0 0 1 1.02-.295l1.995 1.101A.75.75 0 0 1 18 5.75v2a.75.75 0 0 1-1.5 0v-.73l-.884.488a.75.75 0 1 1-.724-1.314l.806-.444-.806-.444a.75.75 0 0 1-.295-1.02ZM7.343 8.284a.75.75 0 0 1 1.02-.294L10 8.893l1.638-.903a.75.75 0 1 1 .724 1.313l-1.612.89v1.557a.75.75 0 0 1-1.5 0v-1.557l-1.612-.89a.75.75 0 0 1-.295-1.019ZM2.75 11.5a.75.75 0 0 1 .75.75v1.557l1.608.887a.75.75 0 0 1-.724 1.314l-1.996-1.101A.75.75 0 0 1 2 14.25v-2a.75.75 0 0 1 .75-.75Zm14.5 0a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-.388.657l-1.996 1.1a.75.75 0 1 1-.724-1.313l1.608-.887V12.25a.75.75 0 0 1 .75-.75Zm-7.25 4a.75.75 0 0 1 .75.75v.73l.888-.49a.75.75 0 0 1 .724 1.313l-2 1.104a.75.75 0 0 1-.724 0l-2-1.104a.75.75 0 1 1 .724-1.313l.888.49v-.73a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
        </svg>
        <span class="logo-text">Private Connect</span>
      </div>
      <p class="subtitle">Temporary tunnel to your local service</p>
    </header>

    <div class="status-badge ${isConnected ? 'connected' : 'disconnected'}">
      <span class="status-dot"></span>
      ${isConnected ? 'Tunnel Active' : 'Tunnel Disconnected'}
    </div>

    <ol class="steps">
      <li class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-label">Public URL</div>
          <div class="step-value">${fullUrl}</div>
        </div>
      </li>
      <li class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-label">Forwarding to</div>
          <div class="step-value white">${tunnel.localHost}:${tunnel.localPort}</div>
        </div>
      </li>
      <li class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-label">Try it out</div>
          <div class="code-block">
            <span class="prompt">$</span> <span class="cmd">curl ${fullUrl}/</span>
          </div>
        </div>
      </li>
    </ol>

    <div class="expires">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Expires in ${expiresIn} minutes
    </div>

    <div class="footer">
      <a href="https://privateconnect.co">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path d="M16.555 5.412a8.028 8.028 0 0 0-3.503-2.81 14.899 14.899 0 0 1 1.663 4.472 8.547 8.547 0 0 0 1.84-1.662ZM13.326 7.825a13.43 13.43 0 0 0-2.413-5.773 8.087 8.087 0 0 0-1.826 0 13.43 13.43 0 0 0-2.413 5.773A8.473 8.473 0 0 0 10 8.5c1.18 0 2.304-.24 3.326-.675ZM6.514 9.376A9.98 9.98 0 0 0 10 10c1.226 0 2.4-.22 3.486-.624a13.54 13.54 0 0 1-.351 3.759A13.54 13.54 0 0 1 10 13.5c-1.079 0-2.128-.127-3.134-.366a13.538 13.538 0 0 1-.352-3.758ZM5.285 7.074a14.9 14.9 0 0 1 1.663-4.471 8.028 8.028 0 0 0-3.503 2.81c.529.638 1.149 1.199 1.84 1.66ZM17.334 6.798a7.973 7.973 0 0 1 .614 4.115 13.47 13.47 0 0 1-3.178 1.72 15.093 15.093 0 0 0 .174-3.939 10.043 10.043 0 0 0 2.39-1.896ZM2.666 6.798a10.042 10.042 0 0 0 2.39 1.896 15.196 15.196 0 0 0 .174 3.94 13.472 13.472 0 0 1-3.178-1.72 7.973 7.973 0 0 1 .615-4.115ZM10 15c.898 0 1.778-.079 2.633-.23a13.473 13.473 0 0 1-1.72 3.178 8.099 8.099 0 0 1-1.826 0 13.47 13.47 0 0 1-1.72-3.178c.855.151 1.735.23 2.633.23ZM14.357 14.357a14.912 14.912 0 0 1-1.305 3.04 8.027 8.027 0 0 0 4.345-4.345c-.953.542-1.971.981-3.04 1.305ZM6.948 17.397a8.027 8.027 0 0 1-4.345-4.345c.953.542 1.971.981 3.04 1.305a14.912 14.912 0 0 0 1.305 3.04Z" />
        </svg>
        Go to privateconnect.co →
      </a>
    </div>
  </main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Override CSP to allow inline styles and Google Fonts for the landing page
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:;");
    return res.status(200).send(html);
  }
}
