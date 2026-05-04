import type { Request, Response } from 'express';
import { handleTransferWebhookByPlaidId } from '../services/plaidTransferService';

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  transfer_id?: string;
  environment?: string;
};

export async function plaidWebhookHandler(req: Request, res: Response): Promise<void> {
  let body: PlaidWebhookBody;
  try {
    const raw = req.body;
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : typeof raw === 'string' ? raw : '{}';
    body = JSON.parse(text) as PlaidWebhookBody;
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  if (body.webhook_type === 'TRANSFER' && body.transfer_id) {
    void handleTransferWebhookByPlaidId(body.transfer_id).catch(() => {
      // logged elsewhere if needed; never throw to webhook caller
    });
  }

  res.status(200).json({ received: true });
}
