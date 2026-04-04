import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import { UserModule } from './user.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(UserModule, {
    transport: Transport.GRPC,
    options: {
      package: 'user',
      protoPath: join(process.cwd(), 'packages/proto/user.proto'),
      url: '0.0.0.0:50051',
    },
  });
  // Use pino logger for the microservice
  app.useLogger(app.get(Logger));
  await app.listen();
  console.log('User Service is running on port 50051');
}
bootstrap();
