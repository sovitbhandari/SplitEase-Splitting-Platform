import { query } from '../utils/db';

export async function savePlaidItem(input: {
  userId: string;
  itemId: string;
  encryptedAccessToken: string;
  iv: string;
  authTag: string;
}): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO plaid_items (user_id, item_id, encrypted_access_token, iv, auth_tag)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (item_id)
     DO UPDATE SET
      user_id = EXCLUDED.user_id,
      encrypted_access_token = EXCLUDED.encrypted_access_token,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag
     RETURNING id`,
    [input.userId, input.itemId, input.encryptedAccessToken, input.iv, input.authTag]
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Failed to save plaid item');
  }
  return row;
}

export async function saveAccounts(
  userId: string,
  plaidItemId: string,
  accounts: Array<{
    accountId: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
    currentBalance: number | null;
    availableBalance: number | null;
    currencyCode: string | null;
  }>
): Promise<void> {
  for (const account of accounts) {
    await query(
      `INSERT INTO accounts (
        user_id, plaid_item_id, plaid_account_id, name, mask, account_type,
        account_subtype, current_balance, available_balance, iso_currency_code
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (plaid_account_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        plaid_item_id = EXCLUDED.plaid_item_id,
        name = EXCLUDED.name,
        mask = EXCLUDED.mask,
        account_type = EXCLUDED.account_type,
        account_subtype = EXCLUDED.account_subtype,
        current_balance = EXCLUDED.current_balance,
        available_balance = EXCLUDED.available_balance,
        iso_currency_code = EXCLUDED.iso_currency_code,
        updated_at = now()`,
      [
        userId,
        plaidItemId,
        account.accountId,
        account.name,
        account.mask,
        account.type,
        account.subtype,
        account.currentBalance,
        account.availableBalance,
        account.currencyCode,
      ]
    );
  }
}

export async function getAccountsByUser(userId: string): Promise<
  Array<{
    id: string;
    plaid_account_id: string;
    name: string;
    mask: string | null;
    account_type: string;
    account_subtype: string | null;
    current_balance: string | null;
    available_balance: string | null;
    iso_currency_code: string | null;
  }>
> {
  const { rows } = await query<{
    id: string;
    plaid_account_id: string;
    name: string;
    mask: string | null;
    account_type: string;
    account_subtype: string | null;
    current_balance: string | null;
    available_balance: string | null;
    iso_currency_code: string | null;
  }>(
    `SELECT id, plaid_account_id, name, mask, account_type, account_subtype,
            current_balance::text, available_balance::text, iso_currency_code
     FROM accounts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}
