import type { PrismaClient } from '../../generated/prisma/client.js';

import type { CreateUserInput, StoredUser } from './auth.types.js';

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | null>;
  create(input: CreateUserInput): Promise<StoredUser>;
}

export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findByEmail(email: string): Promise<StoredUser | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public async create(input: CreateUserInput): Promise<StoredUser> {
    return this.prisma.user.create({ data: input });
  }
}
