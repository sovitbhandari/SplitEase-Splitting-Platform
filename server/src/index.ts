import { createApp } from './app';
import { loadEnv } from './config/env';

const app = createApp();
const { PORT } = loadEnv();

app.listen(PORT, () => {
  console.log(`SplitEase API listening on http://localhost:${PORT}`);
});
