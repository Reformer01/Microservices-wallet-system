import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';

@Controller()
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: { email: string; name: string }) {
    if (!data.email || !data.email.includes('@')) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Invalid email format',
      });
    }
    if (!data.name || data.name.trim().length === 0) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Name is required',
      });
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
        },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new RpcException({
          code: 6, // ALREADY_EXISTS
          message: `User with email ${data.email} already exists`,
        });
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'An unexpected error occurred while creating the user',
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: { id: string }) {
    if (!data.id) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required',
      });
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.id },
      });
      if (!user) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `User with ID ${data.id} not found`,
        });
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (error: any) {
      // Handle invalid UUID format error from Prisma/Postgres
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
