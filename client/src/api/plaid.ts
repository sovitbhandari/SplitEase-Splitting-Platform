import { api } from './axios';

export type ConnectedAccount = {
  id: string;
  plaid_account_id: string;
  name: string;
  mask: string | null;
  account_type: string;
  account_subtype: string | null;
  current_balance: string | null;
  available_balance: string | null;
  iso_currency_code: string | null;
};

export async function getLinkToken(): Promise<string> {
  const { data } = await api.get<{ link_token: string }>('/api/plaid/link-token');
  return data.link_token;
}

export async function exchangeToken(publicToken: string): Promise<ConnectedAccount[]> {
  const { data } = await api.post<{ accounts: ConnectedAccount[] }>(
    '/api/plaid/exchange',
    {
      public_token: publicToken,
    }
  );
  return data.accounts;
}

export async function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  const { data } = await api.get<{ accounts: ConnectedAccount[] }>('/api/plaid/accounts');
  return data.accounts;
}
