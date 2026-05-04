import { z } from 'zod';

const boolish = z
  .string()
  .optional()
  .default('')
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:3000'),
  PLAID_CLIENT_ID: z.string().optional().default(''),
  PLAID_SECRET: z.string().optional().default(''),
  PLAID_WEBHOOK_URL: z.string().optional().default(''),
  /** sandbox | development | production — drives Plaid API base URL */
  PLAID_ENV: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  /** Comma-separated Plaid products for Link, e.g. auth,transactions,transfer */
  PLAID_PRODUCTS: z.string().optional().default('auth,transactions,transfer'),
  PLAID_COUNTRY_CODES: z.string().optional().default('US'),
  PLAID_REDIRECT_URI: z.string().optional().default(''),
  ENABLE_PLAID_TRANSFER_SANDBOX: boolish,
  ENABLE_REAL_MONEY_MOVEMENT: boolish,
  ENCRYPTION_KEY: z.string().min(16).default('local-dev-encryption-key'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) {
    return cached;
  }
  cached = envSchema.parse(process.env);
  return cached;
}
