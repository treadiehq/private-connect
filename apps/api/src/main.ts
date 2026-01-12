import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as http from 'http';

// Immediate logging before any async operations - use stderr for unbuffered output
console.error('=== MAIN.TS LOADED ===');
console.error('Node version:', process.version);
console.error('CWD:', process.cwd());
console.error('Files in dist:', require('fs').readdirSync('.').join(', '));

const port = parseInt(process.env.PORT || '3001', 10);
let appReady = false;
let dbConnected = false;

// Start a minimal health check server immediately so Railway knows we're alive
// This runs BEFORE NestJS bootstraps, so even if DB is down, health checks pass
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      appReady,
      dbConnected,
      timestamp: new Date().toISOString() 
    }));
  } else {
    // Forward to NestJS once it's ready, otherwise return 503
    if (!appReady) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'App starting up...', timestamp: new Date().toISOString() }));
    }
  }
});

async function bootstrap() {
  console.log('=== BOOTSTRAP STARTING ===');
  console.log('Starting NestJS application...');
  console.log('PORT:', port);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  const app = await NestFactory.create(AppModule);
  
  // Cookie parser for session handling
  app.use(cookieParser());
  
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

  // Health check endpoint with DB status
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (req: any, res: any) => {
    res.status(200).json({ 
      status: 'ok', 
      appReady: true,
      dbConnected,
      timestamp: new Date().toISOString() 
    });
  });

  console.log(`=== STARTING LISTENER ON PORT ${port} ===`);
  // Listen on 0.0.0.0 for Railway/Docker
  await app.listen(port, '0.0.0.0');
  
  // Close the temporary health server since NestJS is now handling requests
  healthServer.close();
  
  appReady = true;
  
  // Check if Prisma is connected
  try {
    const prisma = app.get('PrismaService');
    dbConnected = prisma.isConnected?.() ?? false;
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
  // Don't exit - keep health server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===', reason);
});

// Start the temporary health server immediately
healthServer.listen(port, '0.0.0.0', () => {
  console.log(`🏥 Health check server started on port ${port}`);
  
  // Then bootstrap NestJS (which will replace this server)
  bootstrap().catch((err) => {
    console.error('=== BOOTSTRAP FAILED ===', err);
    console.log('🏥 Health server still running - waiting for database...');
    
    // Retry bootstrap every 10 seconds
    const retryBootstrap = setInterval(async () => {
      console.log('🔄 Retrying NestJS bootstrap...');
      try {
        await bootstrap();
        clearInterval(retryBootstrap);
      } catch (retryErr: any) {
        console.error('Bootstrap retry failed:', retryErr?.message || retryErr);
      }
    }, 10000);
  });
});

