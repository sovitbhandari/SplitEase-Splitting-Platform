import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
} from 'plaid';
import { loadEnv, type Env } from '../config/env';

let client: PlaidApi | null = null;
let clientCacheKey = '';

function buildCacheKey(env: Env): string {
  return [env.PLAID_ENV, env.PLAID_CLIENT_ID, env.PLAID_SECRET].join('|');
}

const envPath = PlaidEnvironments as Record<string, string>;

function selectBasePath(env: Env): string {
  if (env.PLAID_ENV === 'production') {
    return envPath.production ?? 'https://production.plaid.com';
  }
  if (env.PLAID_ENV === 'development') {
    return envPath.development ?? 'https://development.plaid.com';
  }
  return envPath.sandbox ?? 'https://sandbox.plaid.com';
}

export function getPlaidClient(): PlaidApi {
  const env = loadEnv();
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET are required for Plaid');
  }
  const key = buildCacheKey(env);
  if (client && clientCacheKey === key) {
    return client;
  }
  const config = new Configuration({
    basePath: selectBasePath(env),
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  });
  client = new PlaidApi(config);
  clientCacheKey = key;
  return client;
}

export function getPlaidBasePathForEnv(): 'sandbox' | 'development' | 'production' {
  const env = loadEnv();
  if (env.PLAID_ENV === 'production') {
    return 'production';
  }
  if (env.PLAID_ENV === 'development') {
    return 'development';
  }
  return 'sandbox';
}

export function isPlaidTransferFeatureEnabled(): boolean {
  const env = loadEnv();
  if (!env.ENABLE_PLAID_TRANSFER_SANDBOX) {
    return false;
  }
  if (env.PLAID_ENV === 'production' && !env.ENABLE_REAL_MONEY_MOVEMENT) {
    return false;
  }
  return true;
}

export function shouldLabelAsSandboxTransfer(): boolean {
  const env = loadEnv();
  if (env.PLAID_ENV !== 'production') {
    return true;
  }
  return !env.ENABLE_REAL_MONEY_MOVEMENT;
}
