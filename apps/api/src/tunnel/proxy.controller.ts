import { Controller, All, Req, Res, Param, Inject, forwardRef } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServicesService } from '../services/services.service';

@Controller('w')
export class ProxyController {
  constructor(
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
      
      res.status(response.status).send(response.body);
    } catch (error) {
      console.error('Proxy error:', error);
      return res.status(502).json({ 
        error: 'Bad gateway',
        message: 'Failed to forward request to the service',
      });
    }
  }

  private async forwardRequest(
    tunnelPort: number,
    targetPath: string,
    req: Request,
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    // Build the target URL (through the tunnel)
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `http://localhost:${tunnelPort}${targetPath || '/'}${queryString}`;
    
    // Collect request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: this.filterHeaders(req.headers as Record<string, string>),
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });

    // Read response body
    const responseBody = Buffer.from(await response.arrayBuffer());
    
    // Convert headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      body: responseBody,
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
