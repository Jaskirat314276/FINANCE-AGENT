/**
 * Demo seed: creates a ready-made user so reviewers can log in instantly.
 *   email: demo@seeker.ai   password: SeekerDemo1
 * Run: npm run db:seed -w @seeker/api
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://seeker:seeker@localhost:5432/seeker_ai?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const passwordHash = await bcrypt.hash('SeekerDemo1', 11);
  const user = await prisma.user.upsert({
    where: { email: 'demo@seeker.ai' },
    update: {},
    create: { email: 'demo@seeker.ai', name: 'Demo Investor', passwordHash, onboarded: true },
  });

  const profile = await prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      age: 29,
      gender: 'MALE',
      occupation: 'Software Engineer',
      city: 'Bengaluru',
      employmentType: 'PRIVATE',
      dependents: 1,
      monthlyIncome: 150_000,
      annualIncome: 1_800_000,
      incomeStability: 'STABLE',
      expectedSalaryGrowthPct: 10,
      currentSavings: 400_000,
      emergencyFund: 300_000,
      monthlyExpenses: 60_000,
      monthlyEmi: 15_000,
      invFd: 200_000,
      invMutualFunds: 350_000,
      invStocks: 150_000,
      invGold: 50_000,
      invCrypto: 25_000,
      invRealEstate: 0,
      invPpf: 120_000,
      invEpf: 280_000,
      riskAnswers: { drop25: 3, sleep: 2, choice: 3, gains: 3, income_loss: 3, experience: 2, loss_tolerance: 2 },
      riskScore: 62,
      riskBand: 'AGGRESSIVE',
      horizon: 'Y5_10',
      monthlySip: 40_000,
      lumpSum: 200_000,
      annualInvestment: 480_000,
      maxSingleStockAllocationPct: 20,
      styles: ['GROWTH', 'DIVIDEND'],
      marketCapPrefs: ['LARGE_CAP', 'MID_CAP'],
      preferredSectors: ['TECHNOLOGY', 'BANKING', 'DEFENCE'],
      avoidSectors: [],
      taxSlab: 'S30',
      used80cAmount: 100_000,
      capitalGainPref: 'LONG_TERM',
      financialHealthScore: 74,
      investmentReadinessScore: 85,
    },
  });

  await prisma.goal.deleteMany({ where: { profileId: profile.id } });
  await prisma.goal.createMany({
    data: [
      { profileId: profile.id, type: 'HOUSE', targetAmount: 5_000_000, targetYears: 7, priority: 1 },
      { profileId: profile.id, type: 'RETIREMENT', targetAmount: 50_000_000, targetYears: 30, priority: 2 },
      { profileId: profile.id, type: 'VACATION', label: 'Europe trip', targetAmount: 500_000, targetYears: 2, priority: 3 },
    ],
  });

  for (const symbol of ['TCS', 'HDFCBANK', 'HAL', 'TATAMOTORS']) {
    await prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId: user.id, symbol } },
      update: {},
      create: { userId: user.id, symbol },
    });
  }

  console.log('✅ Seeded demo user — demo@seeker.ai / SeekerDemo1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
