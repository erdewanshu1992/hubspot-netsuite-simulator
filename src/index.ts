import express from 'express';
import { ENV } from './config/env';
import webhookRoutes from './routes/webhooks';
import erpMockRoutes from './routes/erp.mock';
import { connectDb } from './config/db';
import { requestId, httpLogger } from './middleware/requestContext';

async function main() {
  await connectDb();

  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use(httpLogger);

  app.use(webhookRoutes);
  app.use(erpMockRoutes);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.listen(ENV.PORT, () => {
    console.log(`CRM→ERP sync listening on ${ENV.PORT}`);
  });
}
main().catch((e) => {
  console.error('Fatal boot error', e);
  process.exit(1);
});
