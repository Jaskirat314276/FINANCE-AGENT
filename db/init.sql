-- ─────────────────────────────────────────────────────────────
-- Seeker AI — hand-maintained DDL mirror of prisma/schema.prisma
-- Primary path: `npm run db:push` (Prisma). This file is the
-- fallback for environments where Prisma's engines cannot be
-- downloaded (offline/locked-down networks):
--   psql "$DATABASE_URL" -f db/init.sql
-- Keep in sync with schema.prisma when models change.
-- ─────────────────────────────────────────────────────────────

-- Enums ------------------------------------------------------
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
CREATE TYPE "EmploymentType" AS ENUM ('STUDENT', 'SELF_EMPLOYED', 'BUSINESS', 'GOVERNMENT', 'PRIVATE', 'RETIRED');
CREATE TYPE "IncomeStability" AS ENUM ('VERY_STABLE', 'STABLE', 'VARIABLE', 'UNSTABLE');
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MEDIUM', 'AGGRESSIVE', 'VERY_AGGRESSIVE');
CREATE TYPE "Horizon" AS ENUM ('LT_1Y', 'Y1_3', 'Y3_5', 'Y5_10', 'GT_10Y');
CREATE TYPE "GoalType" AS ENUM ('RETIREMENT', 'HOUSE', 'CAR', 'MARRIAGE', 'CHILD_EDUCATION', 'VACATION', 'WEALTH_CREATION', 'PASSIVE_INCOME', 'FINANCIAL_FREEDOM', 'CUSTOM');
CREATE TYPE "TaxSlab" AS ENUM ('NONE', 'S5', 'S10', 'S15', 'S20', 'S30');
CREATE TYPE "CapitalGainPref" AS ENUM ('LONG_TERM', 'SHORT_TERM', 'BALANCED');
CREATE TYPE "InvestingStyle" AS ENUM ('ESG', 'DIVIDEND', 'GROWTH', 'VALUE', 'MOMENTUM');
CREATE TYPE "MarketCapPref" AS ENUM ('SMALL_CAP', 'MID_CAP', 'LARGE_CAP', 'BLUE_CHIP');
CREATE TYPE "Sector" AS ENUM ('TECHNOLOGY', 'BANKING', 'FINANCIAL_SERVICES', 'HEALTHCARE', 'PHARMA', 'AUTO', 'ENERGY', 'FMCG', 'MANUFACTURING', 'INFRASTRUCTURE', 'METALS', 'TELECOM', 'CONSUMER', 'DEFENCE');
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');
CREATE TYPE "AlertKind" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'PCT_MOVE', 'RSI_OVERBOUGHT', 'RSI_OVERSOLD', 'NEWS', 'FUNDAMENTAL');

-- Tables -----------------------------------------------------
CREATE TABLE "User" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"        TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "passwordHash" TEXT,
  "googleId"     TEXT,
  "avatarUrl"    TEXT,
  "onboarded"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

CREATE TABLE "RefreshToken" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

CREATE TABLE "FinancialProfile" (
  "id"                          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"                      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "age"                         INTEGER NOT NULL,
  "gender"                      "Gender" NOT NULL,
  "occupation"                  TEXT NOT NULL,
  "city"                        TEXT NOT NULL,
  "employmentType"              "EmploymentType" NOT NULL,
  "dependents"                  INTEGER NOT NULL DEFAULT 0,
  "monthlyIncome"               DOUBLE PRECISION NOT NULL,
  "annualIncome"                DOUBLE PRECISION NOT NULL,
  "incomeStability"             "IncomeStability" NOT NULL,
  "expectedSalaryGrowthPct"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentSavings"              DOUBLE PRECISION NOT NULL,
  "emergencyFund"               DOUBLE PRECISION NOT NULL,
  "monthlyExpenses"             DOUBLE PRECISION NOT NULL,
  "monthlyEmi"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invFd"                       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invMutualFunds"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invStocks"                   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invGold"                     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invCrypto"                   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invRealEstate"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invPpf"                      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "invEpf"                      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskAnswers"                 JSONB NOT NULL,
  "riskScore"                   INTEGER NOT NULL,
  "riskBand"                    "RiskBand" NOT NULL,
  "horizon"                     "Horizon" NOT NULL,
  "monthlySip"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lumpSum"                     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "annualInvestment"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxSingleStockAllocationPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
  "styles"                      "InvestingStyle"[] NOT NULL DEFAULT '{}',
  "marketCapPrefs"              "MarketCapPref"[] NOT NULL DEFAULT '{}',
  "preferredSectors"            "Sector"[] NOT NULL DEFAULT '{}',
  "avoidSectors"                "Sector"[] NOT NULL DEFAULT '{}',
  "taxSlab"                     "TaxSlab" NOT NULL,
  "used80cAmount"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "capitalGainPref"             "CapitalGainPref" NOT NULL,
  "financialHealthScore"        INTEGER NOT NULL DEFAULT 0,
  "investmentReadinessScore"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FinancialProfile_userId_key" ON "FinancialProfile"("userId");

CREATE TABLE "Goal" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId"    TEXT NOT NULL REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "type"         "GoalType" NOT NULL,
  "label"        TEXT,
  "targetAmount" DOUBLE PRECISION NOT NULL,
  "targetYears"  DOUBLE PRECISION NOT NULL,
  "priority"     INTEGER NOT NULL DEFAULT 2,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Goal_profileId_idx" ON "Goal"("profileId");

CREATE TABLE "Portfolio" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name"       TEXT NOT NULL,
  "amount"     DOUBLE PRECISION NOT NULL,
  "monthlySip" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskBand"   "RiskBand" NOT NULL,
  "riskScore"  INTEGER NOT NULL,
  "horizon"    "Horizon" NOT NULL,
  "data"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

CREATE TABLE "WatchlistItem" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "symbol"      TEXT NOT NULL,
  "note"        TEXT,
  "targetPrice" DOUBLE PRECISION,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WatchlistItem_userId_symbol_key" ON "WatchlistItem"("userId", "symbol");
CREATE INDEX "WatchlistItem_userId_idx" ON "WatchlistItem"("userId");

CREATE TABLE "Alert" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"          TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "symbol"          TEXT NOT NULL,
  "kind"            "AlertKind" NOT NULL,
  "threshold"       DOUBLE PRECISION,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "message"         TEXT,
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Alert_userId_symbol_idx" ON "Alert"("userId", "symbol");

CREATE TABLE "ChatSession" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title"     TEXT NOT NULL DEFAULT 'New conversation',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

CREATE TABLE "ChatMessage" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"  TEXT NOT NULL REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role"       "ChatRole" NOT NULL,
  "content"    TEXT NOT NULL,
  "structured" JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

CREATE TABLE "AdvisorQuery" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "question"  TEXT NOT NULL,
  "response"  JSONB NOT NULL,
  "meta"      JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdvisorQuery_userId_idx" ON "AdvisorQuery"("userId");

CREATE TABLE "MarketCache" (
  "key"       TEXT PRIMARY KEY,
  "data"      JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
