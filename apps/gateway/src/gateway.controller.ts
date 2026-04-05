import { Controller, Post, Get, Body, Param, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CreateUserDto, CreateWalletDto, TransactionDto } from './dto';

interface UserServiceClient {
  createUser(data: { email: string; name: string }): any;
  getUserById(data: { id: string }): any;
}

interface WalletServiceClient {
  createWallet(data: { userId: string }): any;
  getWallet(data: { userId: string }): any;
  creditWallet(data: { userId: string; amount: number }): any;
  debitWallet(data: { userId: string; amount: number }): any;
  getTransactions(data: { userId: string }): any;
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
  async getTransactions(@Param('userId') userId: string) {
    return await firstValueFrom(this.walletService.getTransactions({ userId }));
  }
}
