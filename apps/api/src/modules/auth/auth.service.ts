import { argon2id, hash, verify } from 'argon2';

import { ApplicationError } from '../../shared/errors/application-error.js';

import type { UserRepository } from './auth.repository.js';
import type { AuthUser } from './auth.types.js';

interface RegisterInput {
  email: string;
  password: string;
  name?: string | null;
  timezone: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  public constructor(private readonly users: UserRepository) {}

  public async register(input: RegisterInput): Promise<AuthUser> {
    const existingUser = await this.users.findByEmail(input.email);
    if (existingUser) {
      throw new ApplicationError(
        'ACCOUNT_CREATION_FAILED',
        'The account could not be created.',
        409,
      );
    }

    const passwordHash = await hash(input.password, { type: argon2id });
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name ?? null,
      timezone: input.timezone,
    });

    return this.toAuthUser(user);
  }

  public async login(input: LoginInput): Promise<AuthUser> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !(await verify(user.passwordHash, input.password))) {
      throw new ApplicationError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
    }

    return this.toAuthUser(user);
  }

  private toAuthUser(user: AuthUser): AuthUser {
    return { id: user.id, email: user.email, name: user.name, timezone: user.timezone };
  }
}
