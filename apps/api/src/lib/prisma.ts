import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env, isProd } from '../config/env';

/**
 * Singleton Prisma client using the Rust-free pg driver adapter
 * (no query-engine binary needed — friendlier to containers/serverless).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: isProd ? ['error'] : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (!isProd) globalForPrisma.prisma = prisma;
