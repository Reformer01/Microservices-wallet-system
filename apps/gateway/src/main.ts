import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import rateLimit from 'express-rate-limit';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  
  // Enable CORS
  app.enableCors();
  
  // Use pino logger for the gateway
  app.useLogger(app.get(Logger));
  
  // Rate limiting middleware
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again after 15 minutes',
    }),
  );

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000, '0.0.0.0');
  console.log('Gateway is running on http://localhost:3000');
}
bootstrap();
