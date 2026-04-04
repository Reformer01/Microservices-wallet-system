import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';

@Controller()
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: { email: string; name: string }) {
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
    } catch (error) {
      throw new RpcException({
        code: 6, // ALREADY_EXISTS
        message: 'User already exists',
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: { id: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.id },
    });
    if (!user) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: 'User not found',
      });
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
