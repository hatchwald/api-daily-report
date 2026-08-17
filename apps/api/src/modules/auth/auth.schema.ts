import { z } from 'zod';

const emailSchema = z.email().trim().toLowerCase().max(254);
const passwordSchema = z.string().min(12).max(128);
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (timezone) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Timezone must be a valid IANA timezone.' },
  );

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).nullable().optional(),
  timezone: timezoneSchema.default('UTC'),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const userProperties = {
  id: { type: 'string', format: 'uuid' },
  email: { type: 'string', format: 'email' },
  name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  timezone: { type: 'string' },
} as const;

export const authUserResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['user'],
      properties: {
        user: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'email', 'name', 'timezone'],
          properties: userProperties,
        },
      },
    },
  },
} as const;

export const authBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 1, maxLength: 128 },
    name: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
    timezone: { type: 'string', minLength: 1, maxLength: 100, default: 'UTC' },
  },
} as const;

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean' },
    error: {
      type: 'object',
      additionalProperties: true,
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } },
    },
  },
} as const;
