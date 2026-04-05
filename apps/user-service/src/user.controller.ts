import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';

@Controller()
export class UserController {
  constructor(private readonly prisma: PrismaService) {}

  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: { email: string; name: string; idempotencyKey?: string }) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Invalid email format. Please provide a valid email address.',
      });
    }
    if (!data.name || data.name.trim().length < 2) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Name is too short. It must be at least 2 characters long.',
      });
    }
    if (data.name.length > 100) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'Name is too long. It must be at most 100 characters long.',
      });
    }

    try {
      // Check for existing user with the same idempotency key
      if (data.idempotencyKey) {
        const existingUser = await this.prisma.user.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });

        if (existingUser) {
          return {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            createdAt: existingUser.createdAt.toISOString(),
          };
        }
      }

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          idempotencyKey: data.idempotencyKey,
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
        // If it's a unique constraint violation on idempotencyKey, try to fetch the user again
        if (data.idempotencyKey && error.meta?.target?.includes('idempotencyKey')) {
          const existingUser = await this.prisma.user.findUnique({
            where: { idempotencyKey: data.idempotencyKey },
          });
          if (existingUser) {
            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              createdAt: existingUser.createdAt.toISOString(),
            };
          }
        }

        throw new RpcException({
          code: 6, // ALREADY_EXISTS
          message: `A user with the email address '${data.email}' is already registered.`,
        });
      }
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'A database error occurred while creating the user profile.',
      });
    }
  }

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: { id: string }) {
    if (!data.id) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: 'User ID is required for this operation.',
      });
    }

    // UUID v4 regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.id)) {
      throw new RpcException({
        code: 3, // INVALID_ARGUMENT
        message: `The provided User ID '${data.id}' is not in a valid UUID v4 format.`,
      });
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.id },
      });
      if (!user) {
        throw new RpcException({
          code: 5, // NOT_FOUND
          message: `No user was found with the ID '${data.id}'.`,
        });
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (error: any) {
      throw new RpcException({
        code: 13, // INTERNAL
        message: 'An error occurred while retrieving the user profile from the database.',
      });
    }
  }

  @GrpcMethod('UserService', 'HealthCheck')
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
