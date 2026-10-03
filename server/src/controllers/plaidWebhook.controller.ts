import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPlaidClient } from '../utils/plaidClient';
import { handleTransferWebhookByPlaidId } from '../services/plaidTransferService';
import { recordProviderWebhook } from '../models/providerWebhook.model';

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  webhook_id?: string;
  transfer_id?: string;
  environment?: string;
};

export async function plaidWebhookHandler(req: Request, res: Response): Promise<void> {
  const verification = req.header('Plaid-Verification');
  if (!verification) {
    res.status(401).json({ error: 'Missing Plaid webhook verification.' });
    return;
  }
  let body: PlaidWebhookBody;
  let rawText: string;
  try {
    const raw = req.body;
    rawText = Buffer.isBuffer(raw) ? raw.toString('utf8') : typeof raw === 'string' ? raw : '{}';
    body = JSON.parse(rawText) as PlaidWebhookBody;
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  try {
    const decoded = jwt.decode(verification, { complete: true });
    const kid = decoded && typeof decoded === 'object' && decoded.header && decoded.header.alg === 'ES256' && typeof decoded.header.kid === 'string'
      ? decoded.header.kid
      : null;
    if (!kid) throw new Error('Missing verification key id');
    const keyResponse = await getPlaidClient().webhookVerificationKeyGet({ key_id: kid });
    const jwk = keyResponse.data.key as unknown as Record<string, unknown>;
    const pem = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
    const claims = jwt.verify(verification, pem, { algorithms: ['ES256'], clockTolerance: 5, maxAge: '5m' }) as jwt.JwtPayload;
    const expectedHash = crypto.createHash('sha256').update(rawText).digest('hex');
    const claimedHash = typeof claims.request_body_sha256 === 'string' ? claims.request_body_sha256 : '';
    const expectedBytes = Buffer.from(expectedHash, 'utf8');
    const claimedBytes = Buffer.from(claimedHash, 'utf8');
    if (expectedBytes.length !== claimedBytes.length || !crypto.timingSafeEqual(expectedBytes, claimedBytes)) {
      throw new Error('Webhook body hash mismatch');
    }
  } catch {
    res.status(401).json({ error: 'Invalid Plaid webhook verification.' });
    return;
  }

  const requestHash = crypto.createHash('sha256').update(rawText).digest('hex');
  const eventKey = body.webhook_id
    ?? [body.webhook_type ?? 'unknown', body.webhook_code ?? 'unknown', body.transfer_id ?? requestHash, requestHash].join(':');
  const firstDelivery = await recordProviderWebhook({
    provider: 'plaid',
    eventKey,
    requestHash,
    payload: body,
  });
  if (!firstDelivery) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  if (body.webhook_type === 'TRANSFER' && body.transfer_id) {
    void handleTransferWebhookByPlaidId(body.transfer_id).catch(() => {
      // logged elsewhere if needed; never throw to webhook caller
    });
  }

  res.status(200).json({ received: true });
}
