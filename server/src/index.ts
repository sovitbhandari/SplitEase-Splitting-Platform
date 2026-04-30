import { createServer } from 'http';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { attachSocketIO } from './sockets';

const app = createApp();
const { PORT } = loadEnv();
const httpServer = createServer(app);
attachSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`SplitEase API listening on http://localhost:${PORT}`);
});
