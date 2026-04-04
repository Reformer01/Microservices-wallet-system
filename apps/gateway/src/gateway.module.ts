import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { GatewayController } from './gateway.controller';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' },
      },
    }),
    ClientsModule.register([
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(process.cwd(), 'packages/proto/user.proto'),
          url: 'localhost:50051',
        },
      },
      {
        name: 'WALLET_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'wallet',
          protoPath: join(process.cwd(), 'packages/proto/wallet.proto'),
          url: 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [GatewayController],
})
export class GatewayModule {}
