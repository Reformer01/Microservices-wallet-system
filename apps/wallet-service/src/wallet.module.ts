import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { WalletController } from './wallet.controller';
import { PrismaService } from './prisma.service';

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
    ]),
  ],
  controllers: [WalletController],
  providers: [PrismaService],
})
export class WalletModule {}
