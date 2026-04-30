import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { loadEnv } from '../config/env';

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (client) {
    return client;
  }
  const env = loadEnv();
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET are required');
  }
  const config = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  });
  client = new PlaidApi(config);
  return client;
}

export const defaultPlaidProducts: Products[] = [Products.Auth, Products.Transactions];
export const defaultCountryCodes: CountryCode[] = [CountryCode.Us];
