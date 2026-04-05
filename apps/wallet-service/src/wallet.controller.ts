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
        message: 'User ID is required to create a wallet.',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.userId)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.userId}' is not in a valid UUID format.`,
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
        message: `Could not find a user with ID '${data.userId}'. A wallet can only be created for an existing user.`,
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
          message: `A wallet already exists for user ID '${data.userId}'. Each user can only have one wallet.`,
        });
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'A database error occurred while creating the wallet.',
      });
    }
  }

  @GrpcMethod('WalletService', 'GetWallet')
  async getWallet(data: { userId: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required to retrieve wallet information.',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.userId)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.userId}' is not in a valid UUID format.`,
      });
    }

    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: data.userId },
      });
      if (!wallet) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `No wallet was found for user ID '${data.userId}'.`,
        });
      }
      return {
        id: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        createdAt: wallet.createdAt.toISOString(),
      };
    } catch (error: any) {
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'An error occurred while fetching wallet details from the database.',
      });
    }
  }

  @GrpcMethod('WalletService', 'CreditWallet')
  async creditWallet(data: { userId: string; amount: number; idempotencyKey?: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required for credit operations.',
      });
    }
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Credit amount must be a positive number greater than zero.',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.userId)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.userId}' is not in a valid UUID format.`,
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
            transactionId: existingTx.transactionId,
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
        const transaction = await tx.transaction.create({
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
          transactionId: transaction.transactionId,
        };
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `Wallet not found for user ID '${data.userId}'. Operation aborted.`,
        });
      }
      if (error.code === 'P2002') {
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
            transactionId: existingTx.transactionId,
          };
        }
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'A database error occurred during the credit transaction.',
      });
    }
  }

  @GrpcMethod('WalletService', 'DebitWallet')
  async debitWallet(data: { userId: string; amount: number; idempotencyKey?: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required for debit operations.',
      });
    }
    if (data.amount <= 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Debit amount must be a positive number greater than zero.',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.userId)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.userId}' is not in a valid UUID format.`,
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
            transactionId: existingTx.transactionId,
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
            message: `Wallet not found for user ID '${data.userId}'. Operation aborted.`,
          });
        }

        if (wallet.balance < data.amount) {
          throw new RpcException({
            code: 9, // FAILED_PRECONDITION
            message: `Insufficient funds. Current balance is ${wallet.balance}, but attempted to debit ${data.amount}.`,
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
        const transaction = await tx.transaction.create({
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
          transactionId: transaction.transactionId,
        };
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
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
            transactionId: existingTx.transactionId,
          };
        }
      }
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'A database error occurred during the debit transaction.',
      });
    }
  }

  @GrpcMethod('WalletService', 'GetTransactions')
  async getTransactions(data: { userId: string; type?: string; startDate?: string; endDate?: string }) {
    if (!data.userId) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required to fetch transaction history.',
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.userId)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.userId}' is not in a valid UUID format.`,
      });
    }

    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: data.userId },
      });

      if (!wallet) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `No wallet found for user ID '${data.userId}'.`,
        });
      }

      const where: any = { walletId: wallet.id };
      if (data.type) {
        where.type = data.type;
      }
      if (data.startDate || data.endDate) {
        where.createdAt = {};
        if (data.startDate) {
          const start = new Date(data.startDate);
          if (!isNaN(start.getTime())) {
            where.createdAt.gte = start;
          }
        }
        if (data.endDate) {
          const end = new Date(data.endDate);
          if (!isNaN(end.getTime())) {
            where.createdAt.lte = end;
          }
        }
      }

      const transactions = await this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          transactionId: t.transactionId,
          type: t.type,
          amount: t.amount,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'An error occurred while retrieving the transaction history.',
      });
    }
  }

  @GrpcMethod('WalletService', 'HealthCheck')
  async healthCheck() {
    let dbStatus = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'DOWN';
    }
    return {
      status: 'UP',
      database: dbStatus,
    };
  }
}
