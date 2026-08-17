import { describe, expect, it } from 'vitest';

import type { ApplicationError } from '../../shared/errors/application-error.js';

import type { UserRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import type { CreateUserInput, StoredUser } from './auth.types.js';

class MemoryUserRepository implements UserRepository {
  public readonly users: StoredUser[] = [];

  public findByEmail(email: string): Promise<StoredUser | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  public create(input: CreateUserInput): Promise<StoredUser> {
    const user = {
      id: crypto.randomUUID(),
      ...input,
    };
    this.users.push(user);
    return Promise.resolve(user);
  }
}

describe('AuthService', () => {
  it('hashes the password before creating a user', async () => {
    const users = new MemoryUserRepository();
    const service = new AuthService(users);

    const result = await service.register({
      email: 'developer@example.com',
      password: 'a-secure-password',
      name: 'Developer',
      timezone: 'Asia/Jakarta',
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(users.users[0]?.passwordHash).not.toBe('a-secure-password');
    expect(users.users[0]?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects registration without revealing that the email already exists', async () => {
    const users = new MemoryUserRepository();
    const service = new AuthService(users);
    const input = {
      email: 'developer@example.com',
      password: 'a-secure-password',
      name: null,
      timezone: 'UTC',
    };
    await service.register(input);

    const duplicateRegistration = service.register(input);

    await expect(duplicateRegistration).rejects.toMatchObject({
      code: 'ACCOUNT_CREATION_FAILED',
      statusCode: 409,
    } satisfies Partial<ApplicationError>);
  });

  it('returns the user when the password is valid', async () => {
    const users = new MemoryUserRepository();
    const service = new AuthService(users);
    await service.register({
      email: 'developer@example.com',
      password: 'a-secure-password',
      name: null,
      timezone: 'UTC',
    });

    const user = await service.login({
      email: 'developer@example.com',
      password: 'a-secure-password',
    });

    expect(user.email).toBe('developer@example.com');
  });

  it('uses the same error for an unknown email and an incorrect password', async () => {
    const users = new MemoryUserRepository();
    const service = new AuthService(users);
    await service.register({
      email: 'developer@example.com',
      password: 'a-secure-password',
      name: null,
      timezone: 'UTC',
    });

    const unknownEmail = service.login({ email: 'unknown@example.com', password: 'wrong' });
    const wrongPassword = service.login({ email: 'developer@example.com', password: 'wrong' });

    await expect(unknownEmail).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(wrongPassword).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});
