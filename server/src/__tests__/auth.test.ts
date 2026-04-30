import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { closePool, query } from '../utils/db';

const app = createApp();

async function truncateAuthTables(): Promise<void> {
  await query(`SELECT set_config('app.allow_ledger_mutation', 'on', false)`);
  await query('DELETE FROM settlements');
  await query('DELETE FROM expense_splits');
  await query('DELETE FROM expenses');
  await query('DELETE FROM ledger_entries');
  await query('DELETE FROM accounts');
  await query('DELETE FROM plaid_items');
  await query('DELETE FROM group_members');
  await query('DELETE FROM groups');
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM email_verifications');
  await query('DELETE FROM users');
  await query(`SELECT set_config('app.allow_ledger_mutation', 'off', false)`);
}

describe('Auth API', () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await truncateAuthTables();
    await closePool();
  });

  describe('POST /api/auth/register', () => {
    it('returns 201, user, accessToken, and refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'password123',
          display_name: 'New User',
        })
        .expect(201);

      expect(res.body.user).toMatchObject({
        email: 'new@example.com',
        display_name: 'New User',
      });
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user).not.toHaveProperty('password');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('refreshToken=')])
      );
    });

    it('returns 409 for duplicate email', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'dup@example.com',
        password: 'password123',
        display_name: 'One',
      });
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'dup@example.com',
          password: 'otherpass12',
          display_name: 'Two',
        })
        .expect(409);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
          display_name: '',
        })
        .expect(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens for valid credentials', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'login@example.com',
        password: 'password123',
        display_name: 'Login User',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('returns 401 for wrong password', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'wrongpw@example.com',
        password: 'password123',
        display_name: 'U',
      });

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrongpw@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 when user not found', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new accessToken when cookie is valid', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'refresh@example.com',
        password: 'password123',
        display_name: 'R',
      });
      const rawCookies = reg.headers['set-cookie'];
      expect(rawCookies).toBeDefined();
      const cookieHeader: string[] = Array.isArray(rawCookies)
        ? rawCookies
        : rawCookies != null
          ? [rawCookies]
          : [];

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      // Access token may match prior value if issued in the same second (same iat);
      // refresh rotation is confirmed by a new Set-Cookie header.
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('refreshToken=')])
      );
    });

    it('returns 401 for invalid cookie', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=not-a-real-jwt'])
        .expect(401);
    });

    it('returns 401 when refresh JWT is expired', async () => {
      const { JWT_REFRESH_SECRET } = process.env;
      const expired = jwt.sign(
        { sub: '00000000-0000-0000-0000-000000000001', jti: 'jti-expired', typ: 'refresh' },
        JWT_REFRESH_SECRET as string,
        { expiresIn: '-10s' }
      );

      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${expired}`])
        .expect(401);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns 200 with user when token is valid', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'me@example.com',
        password: 'password123',
        display_name: 'Me User',
      });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${reg.body.accessToken as string}`)
        .expect(200);

      expect(res.body.user.display_name).toBe('Me User');
      expect(res.body.user).not.toHaveProperty('password_hash');
    });

    it('returns 401 without token', async () => {
      await request(app).get('/api/users/me').expect(401);
    });

    it('returns 401 when access token is expired', async () => {
      const { JWT_SECRET } = process.env;
      const expiredAccess = jwt.sign(
        { sub: '00000000-0000-0000-0000-000000000002', typ: 'access' },
        JWT_SECRET as string,
        { expiresIn: '-30s' }
      );

      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredAccess}`)
        .expect(401);
    });
  });
});
