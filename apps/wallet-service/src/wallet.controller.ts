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
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }

    // Verify user exists
    try {
      await firstValueFrom(this.userService.getUserById({ id: data.userId }));
    } catch (error: any) {
      // Propagate user service error if it's already an RpcException
      if (error.code) {
        throw new RpcException(error);
      }
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: `User with ID ${data.userId} not found or inaccessible`,
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
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new RpcException({
          code: 6, // ALREADY_EXISTS
          message: `Wallet already exists for user ${data.userId}`,
        });
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'An unexpected error occurred while creating the wallet',
      });
    }
  }

  @GrpcMethod('WalletService', 'GetWallet')
  async getWallet(data: { userId: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }

    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: data.userId },
      });
      if (!wallet) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `Wallet not found for user ${data.userId}`,
        });
      }
      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        createdAt: wallet.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2023') {
        throw new RpcException({
          code: 3, // INVALID_ARGUMENT
          message: 'Invalid User ID format',
        });
      }
      throw error;
    }
  }

  @GrpcMethod('WalletService', 'CreditWallet')
  async creditWallet(data: { userId: string; amount: number; idempotencyKey?: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Amount must be greater than zero',
      });
    }

    try {
      // Check for existing transaction with the same idempotency key
      if (data.idempotencyKey) {
        const existingTx = await this.prisma.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { wallet: true },
        });

        if (existingTx) {
          // If transaction exists, return the current wallet state
          // (In a real scenario, you might want to return the state *after* that specific transaction)
          return {
            id: existingTx.wallet.id,
            userId: existingTx.wallet.userId,
            balance: existingTx.wallet.balance,
            createdAt: existingTx.wallet.createdAt.toISOString(),
          };
        }
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
            idempotencyKey: data.idempotencyKey,
          },
        });

        return {
          id: wallet.id,
          userId: wallet.userId,
          balance: wallet.balance,
          createdAt: wallet.createdAt.toISOString(),
        };
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `Wallet not found for user ${data.userId}`,
        });
      }
      if (error.code === 'P2002') {
        // Race condition: transaction was created between our check and the insert
        const existingTx = await this.prisma.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { wallet: true },
        });
        if (existingTx) {
          return {
            id: existingTx.wallet.id,
            userId: existingTx.wallet.userId,
            balance: existingTx.wallet.balance,
            createdAt: existingTx.wallet.createdAt.toISOString(),
          };
        }
      }
      throw error;
    }
  }

  @GrpcMethod('WalletService', 'DebitWallet')
  async debitWallet(data: { userId: string; amount: number; idempotencyKey?: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Amount must be greater than zero',
      });
    }

    try {
      // Check for existing transaction with the same idempotency key
      if (data.idempotencyKey) {
        const existingTx = await this.prisma.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { wallet: true },
        });

        if (existingTx) {
          return {
            id: existingTx.wallet.id,
            userId: existingTx.wallet.userId,
            balance: existingTx.wallet.balance,
            createdAt: existingTx.wallet.createdAt.toISOString(),
          };
        }
      }

      return await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId: data.userId },
        });

        if (!wallet) {
          throw new RpcException({
            code: 5, // NOT_FOUND
            message: `Wallet not found for user ${data.userId}`,
          });
        }

        if (wallet.balance < data.amount) {
          throw new RpcException({
            code: 9, // FAILED_PRECONDITION
            message: `Insufficient balance. Current balance: ${wallet.balance}`,
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
            idempotencyKey: data.idempotencyKey,
          },
        });

        return {
          id: updatedWallet.id,
          userId: updatedWallet.userId,
          balance: updatedWallet.balance,
          createdAt: updatedWallet.createdAt.toISOString(),
        };
      });
    } catch (error: any) {
      if (error.code === 'P2023') {
        throw new RpcException({
          code: 3, // INVALID_ARGUMENT
          message: 'Invalid User ID format',
        });
      }
      if (error.code === 'P2002') {
        // Race condition
        const existingTx = await this.prisma.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          include: { wallet: true },
        });
        if (existingTx) {
          return {
            id: existingTx.wallet.id,
            userId: existingTx.wallet.userId,
            balance: existingTx.wallet.balance,
            createdAt: existingTx.wallet.createdAt.toISOString(),
          };
        }
      }
      throw error;
    }
  }

  @GrpcMethod('WalletService', 'GetTransactions')
  async getTransactions(data: { userId: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }

    try {
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
          message: `Wallet not found for user ${data.userId}`,
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
    } catch (error: any) {
      if (error.code === 'P2023') {
        throw new RpcException({
          code: 3, // INVALID_ARGUMENT
          message: 'Invalid User ID format',
        });
      }
      throw error;
    }
  }
}
