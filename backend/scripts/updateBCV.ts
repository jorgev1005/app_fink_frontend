#!/usr/bin/env ts-node
import 'dotenv/config';
import { updateExchangeRates } from '../src/services/exchangeRate.service';

(async () => {
  try {
    console.log('Updating BCV rates...');
    await updateExchangeRates('BCV');
    console.log('BCV update finished');
    process.exit(0);
  } catch (err: any) {
    console.error('Error updating BCV:', err?.message ?? err);
    process.exit(1);
  }
})();
