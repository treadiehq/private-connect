import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
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

  const port = process.env.PORT || 3001;
  // Listen on 0.0.0.0 for Railway/Docker
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Private Connect API running on port ${port}`);
}

bootstrap();

