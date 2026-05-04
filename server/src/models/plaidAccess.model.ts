import { decrypt, type EncryptedPayload } from '../utils/encryption';
import { query } from '../utils/db';

export type DebtorPlaidContext = {
  accessToken: string;
  plaidAccountId: string;
  plaidItemDbId: string;
};

export async function getDebtorPlaidContextForAccount(input: {
  userId: string;
  internalAccountId: string;
}): Promise<DebtorPlaidContext | null> {
  const { rows } = await query<{
    encrypted_access_token: string;
    iv: string;
    auth_tag: string;
    plaid_account_id: string;
    plaid_item_pk: string;
  }>(
    `SELECT
       pi.encrypted_access_token,
       pi.iv,
       pi.auth_tag,
       a.plaid_account_id,
       pi.id AS plaid_item_pk
     FROM accounts a
     INNER JOIN plaid_items pi ON pi.id = a.plaid_item_id
     WHERE a.user_id = $1 AND a.id = $2`,
    [input.userId, input.internalAccountId]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const payload: EncryptedPayload = {
    encrypted: row.encrypted_access_token,
    iv: row.iv,
    authTag: row.auth_tag,
  };
  const accessToken = decrypt(payload);
  return {
    accessToken,
    plaidAccountId: row.plaid_account_id,
    plaidItemDbId: row.plaid_item_pk,
  };
}
