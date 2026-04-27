import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://splitease:password@localhost:5433/splitease_dev';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars!!';
process.env.CLIENT_ORIGIN ??= 'http://localhost:3000';
