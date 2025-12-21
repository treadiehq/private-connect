import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

// Immediate logging before any async operations
console.log('=== MAIN.TS LOADED ===');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());

async function bootstrap() {
  console.log('=== BOOTSTRAP STARTING ===');
  console.log('Starting NestJS application...');
  console.log('PORT:', process.env.PORT);
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

  // Simple health check endpoint that doesn't need database
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const port = process.env.PORT || 3001;
  console.log(`=== STARTING LISTENER ON PORT ${port} ===`);
  // Listen on 0.0.0.0 for Railway/Docker
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Private Connect API running on port ${port}`);
  console.log('=== APP READY FOR REQUESTS ===');
}

// Catch any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===', reason);
});

bootstrap().catch((err) => {
  console.error('=== BOOTSTRAP FAILED ===', err);
  process.exit(1);
});

