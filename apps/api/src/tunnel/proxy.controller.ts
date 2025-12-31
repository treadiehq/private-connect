import { Controller, All, Req, Res, Param, Inject, forwardRef } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServicesService } from '../services/services.service';
import { proxyRateLimiter, proxySubdomainLimiter } from '../common/rate-limiter';
import { 
  resilientRequest, 
  classifyNetworkError, 
  NetworkErrorType,
  NETWORK_CONFIG,
} from '../common/network';
import { SecureLogger } from '../common/security';

// Security limits
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PATH_LENGTH = 2048;
const MAX_HEADER_SIZE = 8192;

// Proxy-specific timeouts
const PROXY_CONNECT_TIMEOUT_MS = 10000;
const PROXY_REQUEST_TIMEOUT_MS = 30000;

@Controller('w')
export class ProxyController {
  private readonly logger = new SecureLogger('ProxyController');

  constructor(
    @Inject(forwardRef(() => ServicesService))
    private servicesService: ServicesService,
  ) {}

  // Handle requests like: /w/abc123/* -> forward to service with subdomain "abc123"
  @All(':subdomain')
  async proxyRequestRoot(
    @Param('subdomain') subdomain: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleProxy(subdomain, '', req, res);
  }

  @All(':subdomain/*')
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

    // Find service by subdomain
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

    // Check if agent is online
    if (!service.agent?.isOnline) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'The agent exposing this service is currently offline',
      });
    }

    if (!service.tunnelPort) {
      return res.status(503).json({ 
        error: 'Tunnel not ready',
        message: 'The tunnel for this service is not established',
      });
    }

    // Forward request through the tunnel
    try {
      const response = await this.forwardRequest(service.tunnelPort, targetPath, req);
      
      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Remaining', proxyRateLimiter.getRemaining(clientIp).toString());
      
      res.status(response.status).send(response.body);
    } catch (error) {
      const err = error as Error & { code?: string };
      const errorType = classifyNetworkError(err);
      
      this.logger.error(`Proxy error for ${subdomain}: ${err.message} (type: ${errorType})`);
      
      // Provide helpful error messages based on error type
      if (errorType === NetworkErrorType.BLOCKED) {
        return res.status(502).json({ 
          error: 'Connection blocked',
          message: 'The connection to the service was blocked. A firewall or proxy may be interfering.',
          hint: 'Check that no firewall rules are blocking traffic to the tunnel port.',
        });
      } else if (errorType === NetworkErrorType.TLS_ERROR) {
        return res.status(502).json({ 
          error: 'TLS error',
          message: 'A TLS/SSL error occurred when connecting to the service.',
          hint: 'Check that the service certificate is valid and not expired.',
        });
      } else if (err.message.includes('timeout')) {
        return res.status(504).json({ 
          error: 'Gateway timeout',
          message: 'The service did not respond in time.',
          hint: 'The service may be overloaded or experiencing network issues.',
        });
      } else {
        return res.status(502).json({ 
          error: 'Bad gateway',
          message: 'Failed to forward request to the service.',
          hint: 'The tunnel connection may have been interrupted.',
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
}
