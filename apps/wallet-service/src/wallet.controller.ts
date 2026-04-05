import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, GrpcMethod, RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { firstValueFrom } from 'rxjs';

interface UserServiceClient {
  getUserById(data: { id: string }): any;
}

@Controller()
export class WalletController implements OnModuleInit {
  private userService: UserServiceClient;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('USER_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.client.getService<UserServiceClient>('UserService');
  }

  @GrpcMethod('WalletService', 'CreateWallet')
  async createWallet(data: { userId: string }) {
    // Verify user exists
    try {
      await firstValueFrom(this.userService.getUserById({ id: data.userId }));
    } catch (error) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'User not found',
      });
    }

    try {
      const wallet = await this.prisma.wallet.create({
        data: {
          userId: data.userId,
          balance: 0,
        },
      });
      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        createdAt: wallet.createdAt.toISOString(),
      };
    } catch (error) {
      throw new RpcException({
        code: 6, // ALREADY_EXISTS
        message: 'Wallet already exists for this user',
      });
    }
  }

  @GrpcMethod('WalletService', 'GetWallet')
  async getWallet(data: { userId: string }) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: data.userId },
    });
    if (!wallet) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'Wallet not found',
      });
    }
    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
      createdAt: wallet.createdAt.toISOString(),
    };
  }

  @GrpcMethod('WalletService', 'CreditWallet')
  async creditWallet(data: { userId: string; amount: number }) {
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Amount must be greater than zero',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId: data.userId },
        data: {
          balance: {
            increment: data.amount,
          },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: data.amount,
        },
      });

      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        createdAt: wallet.createdAt.toISOString(),
      };
    });
  }

  @GrpcMethod('WalletService', 'DebitWallet')
  async debitWallet(data: { userId: string; amount: number }) {
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Amount must be greater than zero',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: data.userId },
      });

      if (!wallet) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: 'Wallet not found',
        });
      }

      if (wallet.balance < data.amount) {
        throw new RpcException({
          code: 9, // FAILED_PRECONDITION
          message: 'Insufficient balance',
        });
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId: data.userId },
        data: {
          balance: {
            decrement: data.amount,
          },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: data.amount,
        },
      });

      return {
        id: updatedWallet.id,
        userId: updatedWallet.userId,
        balance: updatedWallet.balance,
        createdAt: updatedWallet.createdAt.toISOString(),
      };
    });
  }

  @GrpcMethod('WalletService', 'GetTransactions')
  async getTransactions(data: { userId: string }) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: data.userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'Wallet not found',
      });
    }

    return {
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }
}
