import type { UniverseStock } from '../types/market';

/**
 * Curated NSE universe used by the portfolio engine, screener and the
 * offline demo dataset. This is NOT a recommendation list — it is a
 * liquid, well-covered set the engine filters by the user's profile.
 */
export const STOCK_UNIVERSE: UniverseStock[] = [
  // ── Technology ──────────────────────────────────────────
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'TECHNOLOGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'TCS.NS' },
  { symbol: 'INFY', name: 'Infosys', sector: 'TECHNOLOGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'INFY.NS' },
  { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'TECHNOLOGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'HCLTECH.NS' },
  { symbol: 'WIPRO', name: 'Wipro', sector: 'TECHNOLOGY', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'WIPRO.NS' },
  { symbol: 'LTIM', name: 'LTIMindtree', sector: 'TECHNOLOGY', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'LTIM.NS' },
  { symbol: 'PERSISTENT', name: 'Persistent Systems', sector: 'TECHNOLOGY', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'PERSISTENT.NS' },
  { symbol: 'TATAELXSI', name: 'Tata Elxsi', sector: 'TECHNOLOGY', mcap: 'SMALL', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'TATAELXSI.NS' },
  // ── Banking & Financials ────────────────────────────────
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'BANKING', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'HDFCBANK.NS' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'BANKING', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'ICICIBANK.NS' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'BANKING', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'SBIN.NS' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'BANKING', mcap: 'LARGE', blueChip: true, dividendPayer: false, esgFriendly: true, yahooSymbol: 'KOTAKBANK.NS' },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'BANKING', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'AXISBANK.NS' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'FINANCIAL_SERVICES', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'BAJFINANCE.NS' },
  { symbol: 'HDFCAMC', name: 'HDFC AMC', sector: 'FINANCIAL_SERVICES', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'HDFCAMC.NS' },
  { symbol: 'CDSL', name: 'Central Depository Services', sector: 'FINANCIAL_SERVICES', mcap: 'SMALL', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'CDSL.NS' },
  // ── Energy / Conglomerate ───────────────────────────────
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'ENERGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'RELIANCE.NS' },
  { symbol: 'NTPC', name: 'NTPC', sector: 'ENERGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'NTPC.NS' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'ENERGY', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'POWERGRID.NS' },
  { symbol: 'TATAPOWER', name: 'Tata Power', sector: 'ENERGY', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'TATAPOWER.NS' },
  // ── FMCG / Consumer ─────────────────────────────────────
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'HINDUNILVR.NS' },
  { symbol: 'ITC', name: 'ITC', sector: 'FMCG', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'ITC.NS' },
  { symbol: 'NESTLEIND', name: 'Nestlé India', sector: 'FMCG', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'NESTLEIND.NS' },
  { symbol: 'DMART', name: 'Avenue Supermarts (DMart)', sector: 'CONSUMER', mcap: 'LARGE', blueChip: false, dividendPayer: false, esgFriendly: true, yahooSymbol: 'DMART.NS' },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'CONSUMER', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'TITAN.NS' },
  { symbol: 'ZOMATO', name: 'Eternal (Zomato)', sector: 'CONSUMER', mcap: 'LARGE', blueChip: false, dividendPayer: false, esgFriendly: true, yahooSymbol: 'ETERNAL.NS' },
  // ── Healthcare / Pharma ─────────────────────────────────
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'PHARMA', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'SUNPHARMA.NS' },
  { symbol: 'CIPLA', name: 'Cipla', sector: 'PHARMA', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'CIPLA.NS' },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories", sector: 'PHARMA', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: true, yahooSymbol: 'DRREDDY.NS' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'HEALTHCARE', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'APOLLOHOSP.NS' },
  { symbol: 'LALPATHLAB', name: 'Dr Lal PathLabs', sector: 'HEALTHCARE', mcap: 'SMALL', blueChip: false, dividendPayer: true, esgFriendly: true, yahooSymbol: 'LALPATHLAB.NS' },
  // ── Auto ────────────────────────────────────────────────
  { symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'AUTO', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'TATAMOTORS.NS' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'AUTO', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'MARUTI.NS' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'AUTO', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'M&M.NS' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', sector: 'AUTO', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'EICHERMOT.NS' },
  // ── Manufacturing / Infra / Metals ──────────────────────
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'INFRASTRUCTURE', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'LT.NS' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'MANUFACTURING', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'ULTRACEMCO.NS' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'METALS', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'TATASTEEL.NS' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'METALS', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'HINDALCO.NS' },
  { symbol: 'POLYCAB', name: 'Polycab India', sector: 'MANUFACTURING', mcap: 'MID', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'POLYCAB.NS' },
  { symbol: 'ASTRAL', name: 'Astral', sector: 'MANUFACTURING', mcap: 'SMALL', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'ASTRAL.NS' },
  // ── Defence ─────────────────────────────────────────────
  { symbol: 'HAL', name: 'Hindustan Aeronautics', sector: 'DEFENCE', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'HAL.NS' },
  { symbol: 'BEL', name: 'Bharat Electronics', sector: 'DEFENCE', mcap: 'LARGE', blueChip: false, dividendPayer: true, esgFriendly: false, yahooSymbol: 'BEL.NS' },
  // ── Telecom ─────────────────────────────────────────────
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'TELECOM', mcap: 'LARGE', blueChip: true, dividendPayer: true, esgFriendly: false, yahooSymbol: 'BHARTIARTL.NS' },
];

export const UNIVERSE_BY_SYMBOL: Record<string, UniverseStock> = Object.fromEntries(
  STOCK_UNIVERSE.map((s) => [s.symbol, s]),
);

/** Common ETFs / funds referenced by the portfolio engine (illustrative categories). */
export const FUND_CATALOG = [
  { name: 'Nifty 50 Index Fund / ETF', category: 'INDEX_ETF', risk: 'MODERATE' },
  { name: 'Nifty Next 50 Index Fund', category: 'INDEX_ETF', risk: 'MODERATE' },
  { name: 'Flexi-cap Equity Mutual Fund', category: 'EQUITY_MF', risk: 'MODERATE' },
  { name: 'Mid-cap Equity Mutual Fund', category: 'EQUITY_MF', risk: 'HIGH' },
  { name: 'ELSS Tax-saver Fund (80C)', category: 'EQUITY_MF', risk: 'MODERATE' },
  { name: 'Short-duration Debt Fund', category: 'DEBT_MF', risk: 'LOW' },
  { name: 'Liquid Fund', category: 'DEBT_MF', risk: 'LOW' },
  { name: 'Gold ETF / Sovereign Gold Bond', category: 'GOLD', risk: 'MODERATE' },
] as const;
