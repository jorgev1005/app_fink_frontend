#!/usr/bin/env ts-node
import 'dotenv/config';
import { createCustomRate, getLatestExchangeRate } from '../src/services/exchangeRate.service';

(async () => {
  try {
    const usdToBsEnv = process.env.CUSTOM_USD_TO_BS;
    const eurToBsEnv = process.env.CUSTOM_EUR_TO_BS;

    if (!usdToBsEnv && !process.argv[2]) {
      console.error('Usage: set CUSTOM_USD_TO_BS env var or pass amount as first arg (and optionally CUSTOM_EUR_TO_BS or second arg).');
      process.exit(1);
    }

    const usdToBs = Number(usdToBsEnv ?? process.argv[2]);
    let eurToBs = eurToBsEnv ? Number(eurToBsEnv) : (process.argv[3] ? Number(process.argv[3]) : undefined as any);

    if (!usdToBs || Number.isNaN(usdToBs)) {
      console.error('Invalid USD->Bs amount provided');
      process.exit(1);
    }

    // If eurToBs not provided, try to derive it from latest official rate
    if (!eurToBs) {
      console.log('No EUR->Bs provided, attempting to derive from latest official rate...');
      const latest = await getLatestExchangeRate('BCV');
      if (latest && Number(latest.eurToUsd) && Number(latest.eurToUsd) > 0) {
        eurToBs = usdToBs * Number(latest.eurToUsd);
        console.log(`Derived EUR->Bs = ${eurToBs} using latest BCV eurToUsd = ${latest.eurToUsd}`);
      } else {
        console.error('Could not derive EUR->Bs because no official EUR->USD ratio available. Provide CUSTOM_EUR_TO_BS or second CLI arg.');
        process.exit(1);
      }
    }

    const created = await createCustomRate(usdToBs, eurToBs, 'Created via scripts/createCustomRate.ts');
    console.log('Custom rate created:', created);
    process.exit(0);
  } catch (err: any) {
    console.error('Error creating custom rate:', err?.message ?? err);
    process.exit(1);
  }
})();
