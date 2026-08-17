import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  PROVIDER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_SLUG: z.string().regex(/^[a-zA-Z0-9-]+$/),
  GITHUB_PRIVATE_KEY: z.string().min(1),
  GITLAB_CLIENT_ID: z.string().min(1),
  GITLAB_CLIENT_SECRET: z.string().min(1),
  GITLAB_REDIRECT_URI: z.url(),
  GITLAB_ALLOWED_BASE_URLS: z
    .string()
    .min(1)
    .transform((value) => value.split(',').map((baseUrl) => new URL(baseUrl.trim()).origin)),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}
