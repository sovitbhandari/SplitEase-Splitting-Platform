import type { Request, Response } from 'express';
import { Products } from 'plaid';
import { z } from 'zod';
import { loadEnv } from '../config/env';
import { encrypt } from '../utils/encryption';
import { parseCountryCodes, parsePlaidProducts } from '../utils/plaidProducts';
import { getPlaidClient } from '../utils/plaidClient';
import { getAccountsByUser, saveAccounts, savePlaidItem } from '../models/plaid.model';

const exchangeSchema = z.object({
  public_token: z.string().min(1),
});

function requireUser(req: Request, res: Response): { id: string; email: string } | null {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { id: req.user.id, email: req.user.email };
}

export async function getLinkToken(req: Request, res: Response): Promise<void> {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const env = loadEnv();
  if (!env.PLAID_CLIENT_ID?.trim() || !env.PLAID_SECRET?.trim()) {
    res.status(503).json({
      error:
        'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET (Sandbox keys) to server/.env and restart the server.',
    });
    return;
  }
  const plaid = getPlaidClient();
  const products = parsePlaidProducts(env.PLAID_PRODUCTS);
  const countryCodes = parseCountryCodes(env.PLAID_COUNTRY_CODES);
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'SplitEase',
      products: products.length ? products : [Products.Auth],
      country_codes: countryCodes,
      language: 'en',
      webhook: env.PLAID_WEBHOOK_URL || undefined,
      redirect_uri: env.PLAID_REDIRECT_URI?.trim() ? env.PLAID_REDIRECT_URI.trim() : undefined,
    });
    res.status(200).json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'response' in err
        ? (() => {
            const data = (err as { response?: { data?: { error_message?: string; error_code?: string } } })
              .response?.data;
            if (data?.error_message && typeof data.error_message === 'string') {
              return data.error_code
                ? `${data.error_message} (${data.error_code})`
                : data.error_message;
            }
            return null;
          })()
        : null;
    res.status(502).json({
      error:
        message ??
        (err instanceof Error ? err.message : 'Plaid could not create a link session. Check PLAID_ENV, products, and your Plaid Dashboard settings.'),
    });
  }
}

export async function exchangeToken(req: Request, res: Response): Promise<void> {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const parsed = exchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const plaid = getPlaidClient();
  const exchange = await plaid.itemPublicTokenExchange({
    public_token: parsed.data.public_token,
  });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;
  const sealed = encrypt(accessToken);
  const item = await savePlaidItem({
    userId: user.id,
    itemId,
    encryptedAccessToken: sealed.encrypted,
    iv: sealed.iv,
    authTag: sealed.authTag,
  });

  const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
  await saveAccounts(
    user.id,
    item.id,
    accountsResponse.data.accounts.map((account) => ({
      accountId: account.account_id,
      name: account.name,
      mask: account.mask ?? null,
      type: account.type,
      subtype: account.subtype ?? null,
      currentBalance: account.balances.current ?? null,
      availableBalance: account.balances.available ?? null,
      currencyCode: account.balances.iso_currency_code ?? null,
    }))
  );

  const accounts = await getAccountsByUser(user.id);
  res.status(200).json({ item_id: itemId, accounts });
}

export async function getMyAccounts(req: Request, res: Response): Promise<void> {
  const user = requireUser(req, res);
  if (!user) {
    return;
  }
  const accounts = await getAccountsByUser(user.id);
  res.status(200).json({ accounts });
}
