import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import cookieParser from 'cookie-parser';
import * as http from 'http';

// Immediate logging before any async operations - use stderr for unbuffered output
console.error('=== MAIN.TS LOADED ===');
console.error('Node version:', process.version);
console.error('CWD:', process.cwd());
console.error('Files in dist:', require('fs').readdirSync('.').join(', '));

const port = parseInt(process.env.PORT || '3001', 10);
const isProduction = process.env.NODE_ENV === 'production';
let dbConnected = false;
let healthServer: http.Server | null = null;

// Only use the health server approach in production (Railway)
// In development, just use the standard NestJS startup
function startHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    healthServer = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          appReady: false,
          dbConnected,
          timestamp: new Date().toISOString() 
        }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'App starting up...', timestamp: new Date().toISOString() }));
      }
    });
    healthServer.listen(port, '0.0.0.0', () => {
      console.log(`🏥 Health check server started on port ${port}`);
      resolve();
    });
  });
}

function stopHealthServer(): Promise<void> {
  return new Promise((resolve) => {
    if (healthServer) {
      healthServer.close(() => {
        console.log('🏥 Health check server stopped');
        healthServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function bootstrap() {
  console.log('=== BOOTSTRAP STARTING ===');
  console.log('Starting NestJS application...');
  console.log('PORT:', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  const app = await NestFactory.create(AppModule);
  
  // Cookie parser for session handling
  app.use(cookieParser());
  
  // Rewrite paths for share subdomains (ngrok-style)
  // Subdomain style: {token}.privateconnect.co/* -> /shared/{token}/*
  // Known subdomains (api, www, link, app) are excluded
  app.use((req: any, res: any, next: any) => {
    const host = req.headers.host || '';
    const baseDomain = process.env.BASE_DOMAIN || 'privateconnect.co';
    const knownSubdomains = ['api', 'www', 'link', 'app', 'mail', 'admin'];
    
    // Check for subdomain-style URL: {token}.privateconnect.co
    const subdomainMatch = host.match(new RegExp(`^([^.]+)\\.${baseDomain.replace(/\./g, '\\.')}$`));
    if (subdomainMatch) {
      const subdomain = subdomainMatch[1];
      // Only treat as share token if not a known subdomain
      if (!knownSubdomains.includes(subdomain.toLowerCase())) {
        // Rewrite all paths to include the token
        const originalUrl = req.url;
        req.url = `/shared/${subdomain}${originalUrl}`;
        req.originalUrl = req.url;
        // Store token for later use
        req.shareToken = subdomain;
        req.isSubdomainShare = true;
      }
    }
    next();
  });
  
  // Security headers including CSP to prevent XSS attacks
  app.use((req: any, res: any, next: any) => {
    // Skip strict CSP for Swagger UI routes
    const isSwaggerRoute = req.url.startsWith('/docs') || req.url === '/openapi.json';
    // Shared routes proxy user content and need to be embeddable
    const isSharedRoute = req.url.startsWith('/shared/') || req.url.startsWith('/v1/shared/');
    
    if (isSwaggerRoute) {
      // Relaxed CSP for Swagger UI
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"
      );
    } else if (isSharedRoute) {
      // Allow shared routes to be embedded from privateconnect.co
      const webUrl = process.env.WEB_URL || 'https://privateconnect.co';
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${webUrl} http://localhost:3000`
      );
    } else {
      // Strict CSP for API responses
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; form-action 'none'"
      );
    }
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking (allow for Swagger UI and shared routes)
    if (!isSwaggerRoute && !isSharedRoute) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  
  // Enable CORS for web UI
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  
  // Add production origins from environment
  if (process.env.WEB_URL) {
    allowedOrigins.push(process.env.WEB_URL);
  }
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // OpenAPI/Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Private Connect Control API')
    .setDescription(`
## Overview

Private Connect Control API provides programmatic access to tunnel management, 
agent orchestration, and service connectivity.

## Authentication

All endpoints require authentication via API key passed in the \`x-api-key\` header:

\`\`\`
x-api-key: pc_your_api_key_here
\`\`\`

## Rate Limiting

- Public endpoints: 100 requests/minute
- Authenticated endpoints: 1000 requests/minute

## Versioning

All endpoints are prefixed with \`/v1/\`. Future breaking changes will use \`/v2/\`.
    `)
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-api-key', in: 'header', description: 'Workspace API key' },
      'api-key'
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', description: 'Session token from /v1/auth/login' },
      'bearer'
    )
    .addTag('Status', 'Health checks and system status')
    .addTag('Auth', 'Authentication and session management')
    .addTag('Agents', 'Agent registration and orchestration')
    .addTag('Tunnels', 'Tunnel management (expose, connect, share)')
    .addTag('Services', 'Service registration and diagnostics')
    .addTag('Shares', 'Service sharing and access control')
    .addTag('Audit', 'Audit logs and activity tracking')
    .addTag('API Keys', 'API key management')
    .addTag('Workspace', 'Workspace settings and usage')
    .addTag('Admin', 'Admin operations (requires admin privileges)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Serve OpenAPI spec as JSON
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/openapi.json', (req: any, res: any) => {
    res.json(document);
  });
  
  // Serve Swagger UI at /docs
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Private Connect API Docs',
  });

  // Health check endpoint with DB status
  expressApp.get('/health', (req: any, res: any) => {
    res.status(200).json({ 
      status: 'ok', 
      appReady: true,
      dbConnected,
      timestamp: new Date().toISOString() 
    });
  });

  // Close health server BEFORE NestJS tries to listen (production only)
  await stopHealthServer();

  console.log(`=== STARTING LISTENER ON PORT ${port} ===`);
  // Listen on 0.0.0.0 for Railway/Docker
  await app.listen(port, '0.0.0.0');
  
  // Check if Prisma is connected
  try {
    const prisma = app.get(PrismaService);
    dbConnected = prisma.isConnected() ?? false;
  } catch {
    dbConnected = false;
  }
  
  console.log(`🚀 Private Connect API running on port ${port}`);
  console.log(`📊 Database connected: ${dbConnected}`);
  console.log('=== APP READY FOR REQUESTS ===');
}

// Catch any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===', reason);
});

// Main startup logic
async function main() {
  if (isProduction) {
    // In production (Railway): start health server first, then bootstrap NestJS
    await startHealthServer();
    
    try {
      await bootstrap();
    } catch (err: any) {
      console.error('=== BOOTSTRAP FAILED ===', err);
      console.log('🏥 Health server still running - will retry...');
      
      // Restart health server since bootstrap failed
      await startHealthServer();
      
      // Retry bootstrap every 10 seconds
      const retryBootstrap = setInterval(async () => {
        console.log('🔄 Retrying NestJS bootstrap...');
        try {
          await bootstrap();
          clearInterval(retryBootstrap);
        } catch (retryErr: any) {
          console.error('Bootstrap retry failed:', retryErr?.message || retryErr);
          // Ensure health server is running for next retry
          if (!healthServer) {
            await startHealthServer();
          }
        }
      }, 10000);
    }
  } else {
    // In development: just run bootstrap directly
    bootstrap().catch((err) => {
      console.error('=== BOOTSTRAP FAILED ===', err);
      process.exit(1);
    });
  }
}

main();

