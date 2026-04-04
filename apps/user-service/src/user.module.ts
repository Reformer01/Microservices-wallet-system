import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { UserController } from './user.controller';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: { target: 'pino-pretty' },
      },
    }),
  ],
  controllers: [UserController],
  providers: [PrismaService],
})
export class UserModule {}
