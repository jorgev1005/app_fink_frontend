
import { updateExchangeRates, getLatestExchangeRate } from '../src/services/exchangeRate.service';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function forceUpdate() {
    console.log('--- 🔄 Forzando Actualización de Tasas (Local) ---');
    try {
        console.log('1. Consultando CriptoYa y guardando en BD...');
        // Actualizamos especificamente BINANCE (que ahora usa CriptoYa)
        await updateExchangeRates('BINANCE');
        
        console.log('2. Verificando dato guardado...');
        // 'API' es como se guarda internamente la fuente BINANCE/Paralelo
        const rate = await getLatestExchangeRate('API');
        
        console.log('\n📊 RESULTADO FINAL EN SISTEMA:');
        if (rate) {
            console.log(`=========================================`);
            console.log(`💰 Tasa Binance (USDT): ${rate.usdToBs} Bs`);
            console.log(`📅 Fecha: ${rate.date}`);
            console.log(`=========================================`);
        } else {
            console.log('❌ No se pudo recuperar la tasa guardada.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

forceUpdate();
