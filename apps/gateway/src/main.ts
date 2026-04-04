import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000, '0.0.0.0');
  console.log('Gateway is running on http://localhost:3000');
}
bootstrap();
