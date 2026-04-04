import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import { WalletModule } from './wallet.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(WalletModule, {
    transport: Transport.GRPC,
    options: {
      package: 'wallet',
      protoPath: join(process.cwd(), 'packages/proto/wallet.proto'),
      url: '0.0.0.0:50052',
    },
  });
  // Use pino logger for the microservice
  app.useLogger(app.get(Logger));
  await app.listen();
  console.log('Wallet Service is running on port 50052');
}
bootstrap();
