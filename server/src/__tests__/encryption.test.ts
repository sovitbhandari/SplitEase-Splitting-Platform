import { decrypt, encrypt } from '../utils/encryption';

describe('encryption utility', () => {
  it('decrypt(encrypt(value)) returns original value', () => {
    const original = 'plaid-access-token-sandbox';
    const sealed = encrypt(original);
    const opened = decrypt({
      encrypted: sealed.encrypted,
      iv: sealed.iv,
      authTag: sealed.authTag,
    });
    expect(opened).toBe(original);
  });
});
