import { query } from '../utils/db';

export async function recordProviderWebhook(input: {
  provider: string;
  eventKey: string;
  requestHash: string;
  payload: unknown;
}): Promise<boolean> {
  const result = await query(
    `INSERT INTO provider_webhook_events (provider, event_key, request_hash, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (provider, event_key) DO NOTHING`,
    [input.provider, input.eventKey, input.requestHash, JSON.stringify(input.payload)]
  );
  return result.rowCount === 1;
}
