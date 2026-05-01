import dotenv from 'dotenv';
dotenv.config();

import { generateCFOSummary } from './src/services/cfo.service';

async function run() {
    try {
        console.log('Testing generateCFOSummary...');
        // get a project id from db to test or pass null
        const res = await generateCFOSummary(null as any);
        console.log('Result:', res);
    } catch (e) {
        console.error('Fatal error:', e);
    }
}
run();
