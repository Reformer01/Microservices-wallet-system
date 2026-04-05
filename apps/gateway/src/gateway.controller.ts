import { Controller, Post, Get, Body, Param, Inject, OnModuleInit, Query } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateUserDto, CreateWalletDto, TransactionDto } from './dto';

interface UserServiceClient {
  createUser(data: { email: string; name: string; idempotencyKey: string }): any;
  getUserById(data: { id: string }): any;
  healthCheck(data: {}): any;
}

interface WalletServiceClient {
  createWallet(data: { userId: string }): any;
  getWallet(data: { userId: string }): any;
  creditWallet(data: { userId: string; amount: number; idempotencyKey: string }): any;
  debitWallet(data: { userId: string; amount: number; idempotencyKey: string }): any;
  getTransactions(data: { userId: string; type?: string; startDate?: string; endDate?: string }): any;
  healthCheck(data: {}): any;
}

@Controller()
export class GatewayController implements OnModuleInit {
  private userService: UserServiceClient;
  private walletService: WalletServiceClient;

  constructor(
    @Inject('USER_PACKAGE') private readonly userClient: ClientGrpc,
    @Inject('WALLET_PACKAGE') private readonly walletClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserServiceClient>('UserService');
    this.walletService = this.walletClient.getService<WalletServiceClient>('WalletService');
  }

  @Get('health')
  async getHealth() {
    const health: any = {
      gateway: 'UP',
      services: {},
    };

    try {
      const userHealth = await firstValueFrom(this.userService.healthCheck({}));
      health.services.userService = userHealth;
    } catch (error) {
      health.services.userService = { status: 'DOWN', error: error.message };
    }

    try {
      const walletHealth = await firstValueFrom(this.walletService.healthCheck({}));
      health.services.walletService = walletHealth;
    } catch (error) {
      health.services.walletService = { status: 'DOWN', error: error.message };
    }

    return health;
  }

  @Post('users')
  async createUser(@Body() data: CreateUserDto) {
    return await firstValueFrom(this.userService.createUser(data));
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return await firstValueFrom(this.userService.getUserById({ id }));
  }

  @Post('wallets')
  async createWallet(@Body() data: CreateWalletDto) {
    return await firstValueFrom(this.walletService.createWallet(data));
  }

  @Get('wallets/:userId')
  async getWallet(@Param('userId') userId: string) {
    return await firstValueFrom(this.walletService.getWallet({ userId }));
  }

  @Post('wallets/credit')
  async creditWallet(@Body() data: TransactionDto) {
    return await firstValueFrom(this.walletService.creditWallet(data));
  }

  @Post('wallets/debit')
  async debitWallet(@Body() data: TransactionDto) {
    return await firstValueFrom(this.walletService.debitWallet(data));
  }

  @Get('wallets/:userId/transactions')
  async getTransactions(
    @Param('userId') userId: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await firstValueFrom(this.walletService.getTransactions({ userId, type, startDate, endDate }));
  }
}
