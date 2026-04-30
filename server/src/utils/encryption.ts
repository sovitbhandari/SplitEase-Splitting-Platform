import crypto from 'crypto';
import { loadEnv } from '../config/env';

function getKey(): Buffer {
  const { ENCRYPTION_KEY } = loadEnv();
  const trimmed = ENCRYPTION_KEY.trim();
  if (trimmed.length === 0) {
    throw new Error('ENCRYPTION_KEY is required');
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // fall through to sha256 derivation
  }

  return crypto.createHash('sha256').update(trimmed).digest();
}

export type EncryptedPayload = {
  encrypted: string;
  iv: string;
  authTag: string;
};

export function encrypt(text: string): EncryptedPayload {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decrypt(input: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(input.iv, 'base64');
  const encrypted = Buffer.from(input.encrypted, 'base64');
  const authTag = Buffer.from(input.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const output = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return output.toString('utf8');
}
