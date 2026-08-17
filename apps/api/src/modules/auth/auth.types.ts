export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string | null;
  timezone: string;
}
