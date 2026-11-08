import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { vehiclesRouter } from './routes/vehicles.routes';
import { agenciesRouter } from './routes/agencies.routes';
import { bookingsRouter } from './routes/bookings.routes';
import { reviewsRouter } from './routes/reviews.routes';
import { statsRouter } from './routes/stats.routes';
import { assertLegacyExpressApiEnabled } from './config/legacy-api';

assertLegacyExpressApiEnabled({
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_LEGACY_EXPRESS_API: process.env.ENABLE_LEGACY_EXPRESS_API,
});

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

// ── Security & Parsing ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ClickDrive API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/agencies', agenciesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/stats', statsRouter);

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route introuvable', success: false });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ClickDrive API Error]', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    success: false,
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🚗  ClickDrive API  — v1.0.0        ║
  ║   Port : ${PORT}                        ║
  ║   Env  : ${(process.env.NODE_ENV ?? 'development').padEnd(12)}         ║
  ║   CORS : ${FRONTEND_URL.padEnd(22)} ║
  ╚══════════════════════════════════════╝
  `);
});

export default app;
