import { IsEmail, IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class TransactionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
