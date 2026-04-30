import './env/bootstrap';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { loadEnv } from './config/env';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import groupRoutes from './routes/group.routes';
import plaidRoutes from './routes/plaid.routes';
import expenseRoutes from './routes/expense.routes';
import settlementRoutes from './routes/settlement.routes';
import { errorHandler } from './middleware/error.middleware';

export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/groups', expenseRoutes);
  app.use('/api/groups', settlementRoutes);
  app.use('/api/plaid', plaidRoutes);

  app.use(errorHandler);
  return app;
}
