#!/usr/bin/env ts-node
import 'dotenv/config';
import { updateExchangeRates } from '../src/services/exchangeRate.service';

(async () => {
  try {
    console.log('Updating Binance rates...');
    await updateExchangeRates('BINANCE');
    console.log('Binance update finished');
    process.exit(0);
  } catch (err: any) {
    console.error('Error updating Binance:', err?.message ?? err);
    process.exit(1);
  }
})();
