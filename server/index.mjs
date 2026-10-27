import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { admin } from './admin.mjs';
import { api } from './routes.mjs';
import { demo } from './demo.mjs';
import { reviews } from './reviews.mjs';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use('/api/demo-requests', demo);
app.use('/api/reviews', reviews);
app.use('/api/admin', admin);
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Production: serve the built site and fall back to index.html for client routes.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Body-parser failures (e.g. 413 file too large) are the client's to fix: pass them on.
  const status = err.status ?? err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? 'File is too large.' : err.expose ? err.message : 'Bad request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
