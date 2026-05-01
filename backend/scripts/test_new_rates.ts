
import { fetchBinanceRates, updateExchangeRates } from '../src/services/exchangeRate.service';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function test() {
    console.log('--- Testing New Binance Rate Logic ---');
    try {
        console.log('Fetching Binance Rate...');
        const rate = await fetchBinanceRates();
        console.log('Result:', rate);

        if (rate && rate.USD) {
            console.log(`✅ Rate fetched: ${rate.USD} Bs/USDT`);
            console.log('If this matches CriptoYa "ask" price, it is working.');
        } else {
            console.log('❌ Failed to fetch rate.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
