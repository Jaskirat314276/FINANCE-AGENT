import type { Sector } from '../types/profile';

export const INDEX_DEFS = [
  { key: 'NIFTY50', name: 'NIFTY 50', yahooSymbol: '^NSEI' },
  { key: 'SENSEX', name: 'SENSEX', yahooSymbol: '^BSESN' },
  { key: 'BANKNIFTY', name: 'BANK NIFTY', yahooSymbol: '^NSEBANK' },
  { key: 'NIFTYMIDCAP', name: 'NIFTY MIDCAP 100', yahooSymbol: 'NIFTY_MIDCAP_100.NS' },
  { key: 'NIFTYIT', name: 'NIFTY IT', yahooSymbol: '^CNXIT' },
] as const;

export const SECTOR_LABELS: Record<Sector, string> = {
  TECHNOLOGY: 'Technology',
  BANKING: 'Banking',
  FINANCIAL_SERVICES: 'Financial Services',
  HEALTHCARE: 'Healthcare',
  PHARMA: 'Pharma',
  AUTO: 'Auto',
  ENERGY: 'Energy & Power',
  FMCG: 'FMCG',
  MANUFACTURING: 'Manufacturing',
  INFRASTRUCTURE: 'Infrastructure',
  METALS: 'Metals & Mining',
  TELECOM: 'Telecom',
  CONSUMER: 'Consumer & Retail',
  DEFENCE: 'Defence & Aerospace',
};

/** IST market hours (NSE). */
export const MARKET_HOURS_IST = { open: '09:15', close: '15:30' };
