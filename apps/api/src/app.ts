import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { profileRouter } from './modules/profile/profile.routes';
import { marketRouter, stocksRouter } from './modules/market/market.routes';
import { advisorRouter } from './modules/advisor/advisor.routes';
import { portfolioRouter } from './modules/portfolio/portfolio.routes';
import { strategiesRouter } from './modules/strategies/strategies.routes';
import { watchlistRouter } from './modules/watchlist/watchlist.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { insightsRouter } from './modules/insights/insights.routes';
import { screenerRouter } from './modules/screener/screener.routes';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  // Normalize configured origins defensively — dashboard-pasted values often
  // carry stray quotes, trailing slashes, or whitespace, and a browser Origin
  // header never has any of those. Logged at boot so misconfig is visible.
  const corsOrigins = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/^["']+|["']+$/g, '').replace(/\/+$/, ''))
    .filter(Boolean);
  logger.info(`CORS origins: [${corsOrigins.join(' | ')}]`);
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'seeker-api', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/market', marketRouter);
  app.use('/api/stocks', stocksRouter);
  app.use('/api/advisor', advisorRouter);
  app.use('/api/portfolio', portfolioRouter);
  app.use('/api/strategies', strategiesRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/insights', insightsRouter);
  app.use('/api/screener', screenerRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
