/**
 * Offline demo dataset for the mock provider. Values are indicative,
 * loosely calibrated to real ranges so demo mode feels realistic.
 * Every response produced from this file is tagged source="mock (demo data)".
 */

export interface SampleFundamentalRow {
  price: number; // base price ₹
  pe: number | null;
  eps: number | null;
  pb: number | null;
  roe: number | null;
  roce: number | null;
  de: number | null; // debt-to-equity
  divYield: number | null; // %
  mcap: number; // ₹
  revenue: number; // ₹ TTM
  revGrowth: number; // %
  profitGrowth: number; // %
  beta: number;
}

const CR = 1_00_00_000; // 1 crore in ₹

export const SAMPLE_FUNDAMENTALS: Record<string, SampleFundamentalRow> = {
  TCS: { price: 4150, pe: 29, eps: 143, pb: 15.2, roe: 51, roce: 64, de: 0.1, divYield: 1.4, mcap: 1_500_000 * CR, revenue: 245_000 * CR, revGrowth: 7, profitGrowth: 9, beta: 0.8 },
  INFY: { price: 1850, pe: 27, eps: 68.5, pb: 8.6, roe: 32, roce: 40, de: 0.1, divYield: 2.4, mcap: 770_000 * CR, revenue: 158_000 * CR, revGrowth: 6, profitGrowth: 8, beta: 0.9 },
  HCLTECH: { price: 1900, pe: 28, eps: 68, pb: 7.4, roe: 25, roce: 30, de: 0.08, divYield: 2.8, mcap: 515_000 * CR, revenue: 112_000 * CR, revGrowth: 8, profitGrowth: 10, beta: 0.85 },
  WIPRO: { price: 560, pe: 25, eps: 22.4, pb: 3.9, roe: 17, roce: 20, de: 0.2, divYield: 1.2, mcap: 293_000 * CR, revenue: 90_000 * CR, revGrowth: 2, profitGrowth: 5, beta: 0.9 },
  LTIM: { price: 6200, pe: 40, eps: 155, pb: 9.1, roe: 25, roce: 31, de: 0.1, divYield: 1.1, mcap: 184_000 * CR, revenue: 36_000 * CR, revGrowth: 6, profitGrowth: 5, beta: 1.0 },
  PERSISTENT: { price: 6400, pe: 65, eps: 98, pb: 14.8, roe: 24, roce: 30, de: 0.05, divYield: 0.5, mcap: 99_000 * CR, revenue: 11_000 * CR, revGrowth: 16, profitGrowth: 20, beta: 1.05 },
  TATAELXSI: { price: 7800, pe: 60, eps: 130, pb: 18.5, roe: 34, roce: 43, de: 0, divYield: 0.9, mcap: 48_600 * CR, revenue: 3_700 * CR, revGrowth: 9, profitGrowth: 6, beta: 1.0 },
  HDFCBANK: { price: 1720, pe: 19, eps: 90, pb: 2.8, roe: 17, roce: null, de: null, divYield: 1.1, mcap: 1_310_000 * CR, revenue: 310_000 * CR, revGrowth: 12, profitGrowth: 11, beta: 0.9 },
  ICICIBANK: { price: 1250, pe: 18.5, eps: 67, pb: 3.3, roe: 18, roce: null, de: null, divYield: 0.8, mcap: 880_000 * CR, revenue: 186_000 * CR, revGrowth: 15, profitGrowth: 14, beta: 0.95 },
  SBIN: { price: 850, pe: 10.5, eps: 81, pb: 1.6, roe: 17, roce: null, de: null, divYield: 1.6, mcap: 758_000 * CR, revenue: 466_000 * CR, revGrowth: 11, profitGrowth: 12, beta: 1.05 },
  KOTAKBANK: { price: 1800, pe: 18, eps: 100, pb: 2.7, roe: 15, roce: null, de: null, divYield: 0.1, mcap: 358_000 * CR, revenue: 96_000 * CR, revGrowth: 13, profitGrowth: 10, beta: 0.9 },
  AXISBANK: { price: 1150, pe: 13, eps: 88, pb: 2.1, roe: 18, roce: null, de: null, divYield: 0.1, mcap: 355_000 * CR, revenue: 137_000 * CR, revGrowth: 12, profitGrowth: 13, beta: 1.05 },
  BAJFINANCE: { price: 7200, pe: 30, eps: 240, pb: 5.6, roe: 22, roce: null, de: 3.9, divYield: 0.5, mcap: 445_000 * CR, revenue: 66_000 * CR, revGrowth: 26, profitGrowth: 16, beta: 1.2 },
  HDFCAMC: { price: 4300, pe: 42, eps: 102, pb: 12.5, roe: 30, roce: 38, de: 0, divYield: 1.6, mcap: 92_000 * CR, revenue: 3_500 * CR, revGrowth: 18, profitGrowth: 22, beta: 0.95 },
  CDSL: { price: 1600, pe: 65, eps: 25, pb: 18.9, roe: 30, roce: 38, de: 0, divYield: 0.7, mcap: 33_400 * CR, revenue: 1_100 * CR, revGrowth: 28, profitGrowth: 30, beta: 1.1 },
  RELIANCE: { price: 2950, pe: 28, eps: 105, pb: 2.4, roe: 9.5, roce: 10, de: 0.4, divYield: 0.35, mcap: 1_995_000 * CR, revenue: 940_000 * CR, revGrowth: 8, profitGrowth: 6, beta: 1.0 },
  NTPC: { price: 360, pe: 16, eps: 22.5, pb: 2.1, roe: 13, roce: 10, de: 1.4, divYield: 2.2, mcap: 350_000 * CR, revenue: 180_000 * CR, revGrowth: 9, profitGrowth: 10, beta: 0.9 },
  POWERGRID: { price: 310, pe: 18, eps: 17, pb: 3.2, roe: 19, roce: 13, de: 1.9, divYield: 3.6, mcap: 288_000 * CR, revenue: 46_000 * CR, revGrowth: 4, profitGrowth: 5, beta: 0.8 },
  TATAPOWER: { price: 400, pe: 33, eps: 12, pb: 3.9, roe: 12, roce: 11, de: 1.5, divYield: 0.5, mcap: 128_000 * CR, revenue: 64_000 * CR, revGrowth: 12, profitGrowth: 15, beta: 1.3 },
  HINDUNILVR: { price: 2400, pe: 55, eps: 44, pb: 11.2, roe: 21, roce: 28, de: 0, divYield: 1.8, mcap: 564_000 * CR, revenue: 62_000 * CR, revGrowth: 3, profitGrowth: 4, beta: 0.5 },
  ITC: { price: 430, pe: 26, eps: 16.5, pb: 7.3, roe: 28, roce: 36, de: 0, divYield: 3.2, mcap: 537_000 * CR, revenue: 76_000 * CR, revGrowth: 6, profitGrowth: 5, beta: 0.7 },
  NESTLEIND: { price: 2300, pe: 72, eps: 32, pb: 55, roe: 85, roce: 60, de: 0.1, divYield: 1.4, mcap: 222_000 * CR, revenue: 20_000 * CR, revGrowth: 8, profitGrowth: 7, beta: 0.4 },
  DMART: { price: 4000, pe: 95, eps: 42, pb: 13.5, roe: 14, roce: 19, de: 0, divYield: 0, mcap: 260_000 * CR, revenue: 57_000 * CR, revGrowth: 17, profitGrowth: 9, beta: 0.8 },
  TITAN: { price: 3400, pe: 88, eps: 39, pb: 29, roe: 32, roce: 25, de: 0.6, divYield: 0.3, mcap: 302_000 * CR, revenue: 51_000 * CR, revGrowth: 20, profitGrowth: 8, beta: 0.9 },
  ZOMATO: { price: 250, pe: 300, eps: 0.8, pb: 7.8, roe: 1.5, roce: 1, de: 0, divYield: 0, mcap: 240_000 * CR, revenue: 15_000 * CR, revGrowth: 60, profitGrowth: 120, beta: 1.4 },
  SUNPHARMA: { price: 1750, pe: 38, eps: 46, pb: 6.3, roe: 17, roce: 20, de: 0.05, divYield: 0.85, mcap: 420_000 * CR, revenue: 52_000 * CR, revGrowth: 10, profitGrowth: 15, beta: 0.7 },
  CIPLA: { price: 1500, pe: 27, eps: 55, pb: 4.4, roe: 17, roce: 22, de: 0.05, divYield: 0.9, mcap: 121_000 * CR, revenue: 27_000 * CR, revGrowth: 8, profitGrowth: 12, beta: 0.7 },
  DRREDDY: { price: 1250, pe: 19, eps: 66, pb: 3.6, roe: 19, roce: 22, de: 0.1, divYield: 0.65, mcap: 104_000 * CR, revenue: 32_000 * CR, revGrowth: 12, profitGrowth: 10, beta: 0.7 },
  APOLLOHOSP: { price: 7000, pe: 75, eps: 93, pb: 13.8, roe: 15, roce: 15, de: 0.5, divYield: 0.25, mcap: 100_000 * CR, revenue: 20_000 * CR, revGrowth: 15, profitGrowth: 18, beta: 0.9 },
  LALPATHLAB: { price: 2900, pe: 60, eps: 48, pb: 12.1, roe: 21, roce: 26, de: 0.1, divYield: 0.8, mcap: 24_200 * CR, revenue: 2_300 * CR, revGrowth: 10, profitGrowth: 14, beta: 0.8 },
  TATAMOTORS: { price: 780, pe: 8.5, eps: 92, pb: 2.8, roe: 28, roce: 20, de: 1.0, divYield: 0.4, mcap: 288_000 * CR, revenue: 440_000 * CR, revGrowth: 12, profitGrowth: 30, beta: 1.5 },
  MARUTI: { price: 12500, pe: 27, eps: 465, pb: 4.6, roe: 17, roce: 22, de: 0, divYield: 1.0, mcap: 393_000 * CR, revenue: 145_000 * CR, revGrowth: 12, profitGrowth: 20, beta: 0.9 },
  'M&M': { price: 3000, pe: 30, eps: 100, pb: 5.4, roe: 18, roce: 14, de: 1.6, divYield: 0.7, mcap: 373_000 * CR, revenue: 142_000 * CR, revGrowth: 14, profitGrowth: 18, beta: 1.1 },
  EICHERMOT: { price: 5000, pe: 33, eps: 152, pb: 7.6, roe: 24, roce: 31, de: 0, divYield: 1.0, mcap: 137_000 * CR, revenue: 17_500 * CR, revGrowth: 12, profitGrowth: 15, beta: 0.9 },
  LT: { price: 3600, pe: 38, eps: 95, pb: 5.4, roe: 15, roce: 12, de: 1.1, divYield: 0.9, mcap: 495_000 * CR, revenue: 225_000 * CR, revGrowth: 17, profitGrowth: 20, beta: 1.1 },
  ULTRACEMCO: { price: 11500, pe: 47, eps: 245, pb: 5.5, roe: 12, roce: 13, de: 0.4, divYield: 0.6, mcap: 332_000 * CR, revenue: 71_000 * CR, revGrowth: 11, profitGrowth: 8, beta: 0.9 },
  TATASTEEL: { price: 160, pe: 55, eps: 2.9, pb: 2.2, roe: 4, roce: 6, de: 0.75, divYield: 2.2, mcap: 200_000 * CR, revenue: 230_000 * CR, revGrowth: -2, profitGrowth: -20, beta: 1.3 },
  HINDALCO: { price: 650, pe: 12, eps: 54, pb: 1.6, roe: 12, roce: 12, de: 0.5, divYield: 0.5, mcap: 146_000 * CR, revenue: 216_000 * CR, revGrowth: 5, profitGrowth: 12, beta: 1.4 },
  POLYCAB: { price: 6800, pe: 55, eps: 124, pb: 12.4, roe: 22, roce: 29, de: 0.05, divYield: 0.5, mcap: 102_000 * CR, revenue: 18_000 * CR, revGrowth: 20, profitGrowth: 17, beta: 1.1 },
  ASTRAL: { price: 1900, pe: 90, eps: 21, pb: 15.2, roe: 17, roce: 22, de: 0, divYield: 0.2, mcap: 51_000 * CR, revenue: 5_600 * CR, revGrowth: 9, profitGrowth: 6, beta: 1.0 },
  HAL: { price: 4500, pe: 38, eps: 118, pb: 10.2, roe: 26, roce: 33, de: 0, divYield: 1.0, mcap: 301_000 * CR, revenue: 30_000 * CR, revGrowth: 10, profitGrowth: 25, beta: 1.1 },
  BEL: { price: 320, pe: 48, eps: 6.7, pb: 12.9, roe: 24, roce: 31, de: 0, divYield: 0.7, mcap: 234_000 * CR, revenue: 20_000 * CR, revGrowth: 14, profitGrowth: 28, beta: 1.2 },
  BHARTIARTL: { price: 1650, pe: 75, eps: 22, pb: 10.5, roe: 15, roce: 12, de: 2.4, divYield: 0.5, mcap: 990_000 * CR, revenue: 152_000 * CR, revGrowth: 8, profitGrowth: 30, beta: 0.8 },
};

export const SAMPLE_INDICES: Record<string, { name: string; base: number }> = {
  NIFTY50: { name: 'NIFTY 50', base: 24_800 },
  SENSEX: { name: 'SENSEX', base: 81_400 },
  BANKNIFTY: { name: 'BANK NIFTY', base: 53_600 },
  NIFTYMIDCAP: { name: 'NIFTY MIDCAP 100', base: 57_200 },
  NIFTYIT: { name: 'NIFTY IT', base: 38_100 },
};

export const SAMPLE_NEWS_TEMPLATES = [
  { title: '{name} Q1 results: revenue in line, margin commentary in focus', source: 'Demo Wire' },
  { title: 'Brokerages split on {name} after management guidance update', source: 'Demo Wire' },
  { title: '{name} announces capacity expansion; analysts see multi-year tailwind', source: 'Demo Business' },
  { title: 'FII flows swing sector positioning; {name} among most-traded names', source: 'Demo Markets' },
  { title: '{name} board to consider dividend at upcoming meeting', source: 'Demo Business' },
];
