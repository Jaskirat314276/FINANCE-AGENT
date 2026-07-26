/**
 * Must be the FIRST import of any test file: forces offline demo mode
 * before config/env is evaluated, so tests never touch the network.
 */
process.env.MARKET_PROVIDERS = 'mock';
process.env.AI_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';
