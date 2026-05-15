import axios from 'axios';
import prisma from '../config/database';

/**
 * Servicio para gestionar tipos de cambio
 * Obtiene tasas del BCV y permite tasas personalizadas
 */

interface BCVRate {
  USD: number;
  EUR: number;
}

/**
 * Obtener tasa de cambio del BCV
 * Usa: https://ve.dolarapi.com/v1/dolares/oficial para USD
 * Usa: https://ve.dolarapi.com/v1/euros/oficial para EUR
 */
export const fetchBCVRates = async (): Promise<BCVRate | null> => {
  try {
    // 1. Obtener USD/BCV oficial desde dolarapi
    const bcvResponse = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', {
      timeout: 5000
    });
    const bcvData = bcvResponse.data;

    let usdRate = 0;
    if (bcvData && bcvData.promedio) {
      usdRate = parseFloat(bcvData.promedio);
    }

    // 2. Obtener EUR/BCV desde dolarapi (oficial)
    let eurRate = 0;
    try {
      const eurResponse = await axios.get('https://ve.dolarapi.com/v1/euros/oficial', { timeout: 5000 });
      const eurData = eurResponse.data;
      if (eurData && eurData.promedio) {
        eurRate = parseFloat(eurData.promedio);
      }
    } catch (eurErr) {
      console.warn('⚠️ Error fetching EUR rate, calculating fallback:', (eurErr as any)?.message);
      // Fallback: calcular EUR basado en USD
      if (usdRate > 0) {
        const EUR_USD_RATE = 1.15; // Aproximación más realista
        eurRate = usdRate * EUR_USD_RATE;
      }
    }

    if (usdRate > 0) {
      return {
        USD: usdRate,
        EUR: eurRate
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching BCV rates:', error);
    return null;
  }
};

/**
 * Intento de obtener tasa desde BINANCE (USDT/VES).
 * Usa: https://criptoya.com/api/binancep2p/usdt/ves
 * Obtiene el precio real del libro de órdenes P2P de Binance.
 */
export const fetchBinanceRates = async (): Promise<BCVRate | null> => {
  try {
    // 1. Intentar con CriptoYa (Fuente Primaria - Tiempo Real)
    try {
      const response = await axios.get('https://criptoya.com/api/binancep2p/usdt/ves', { timeout: 5000 });
      const data = response.data;
      
      // "ask": El precio más barato para comprar 1 USDT (Precio de reposición)
      // "bid": El precio que te pagan por vender 1 USDT
      // Usamos 'ask' como referencia conservadora para costos/reposición, o 'bid' para valoración de activos líquidos.
      // Para fijación de precios, se suele preferir un valor que garantice la recompra (ask).
      if (data && data.ask) {
        // En CriptoYa, ask es numérico directo
        return { USD: Number(data.ask), EUR: 0 };
      }
    } catch (e) {
      console.warn('⚠️ CriptoYa API failed, trying fallback...', (e as any)?.message);
    }

    // 2. Fallback: DolarApi (Fuente Secundaria - Generica)
    const response = await axios.get('https://ve.dolarapi.com/v1/dolares', { timeout: 5000 });
    const data = response.data;

    if (Array.isArray(data)) {
      // Buscar tasa paralelo (mercado P2P, más cercana a USDT)
      const paralelo = data.find((d: any) => 
        d.fuente === 'paralelo' || 
        (d.nombre && d.nombre.toLowerCase().includes('paralelo'))
      );
      
      if (paralelo && paralelo.promedio) {
        const rawRate = parseFloat(paralelo.promedio);
        // Aplicar margen de seguridad del 1% si usamos el promedio genérico y falló Binance directo
        const rate = rawRate * 1.01;
        return { USD: rate, EUR: 0 };
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error fetching Binance rates:', (error as any)?.message ?? String(error));
    return null;
  }
};

/**
 * Intento de obtener tasa desde Bybit. Se puede configurar BYBIT_API_URL y BYBIT_SYMBOL
 * Se espera que la respuesta incluya un campo con el precio (varía según endpoint), intentamos leer price/last/lastPrice
 */
export const fetchBybitRates = async (): Promise<BCVRate | null> => {
  try {
    const baseUrl = process.env.BYBIT_API_URL || 'https://api.bybit.com/spot/quote/v1/ticker/24hr';
    const symbol = process.env.BYBIT_SYMBOL || process.env.BINANCE_SYMBOL || 'BTCUSDT';

    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}symbol=${encodeURIComponent(symbol)}`;
    const response = await axios.get(url, { timeout: 5000 });
    // Try several possible shapes
    const data = response.data;
    const priceStr = data?.lastPrice ?? data?.last_price ?? data?.price ?? data?.result?.lastPrice ?? data?.result?.last_price ?? data?.result?.price;
    const usd = Number(priceStr);
    if (!usd || Number.isNaN(usd)) {
      console.warn('⚠️ Bybit returned invalid price for', symbol, data);
      return null;
    }
    return { USD: usd, EUR: 0 };
  } catch (error) {
    console.error('❌ Error fetching Bybit rates:', (error as any)?.message ?? String(error));
    return null;
  }
};

/**
 * Intento de obtener tasa desde Coinbase (public prices endpoint)
 * Usa COINBASE_PAIR (ej: USDT-VES) y la API pública /v2/prices/:pair/spot
 */
export const fetchCoinbaseRates = async (): Promise<BCVRate | null> => {
  try {
    const pair = process.env.COINBASE_PAIR || 'USDT-VES';
    const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`;
    const response = await axios.get(url, { timeout: 5000 });
    const amount = response.data?.data?.amount ?? response.data?.amount;
    const usd = Number(amount);
    if (!usd || Number.isNaN(usd)) {
      console.warn('⚠️ Coinbase returned invalid price for', pair, response.data);
      return null;
    }
    return { USD: usd, EUR: 0 };
  } catch (error) {
    console.error('❌ Error fetching Coinbase rates:', (error as any)?.message ?? String(error));
    return null;
  }
};

/**
 * Actualizar tasas de cambio en la base de datos
 */
export const updateExchangeRates = async (source: 'BCV' | 'BINANCE' | 'CUSTOM' = 'BCV'): Promise<void> => {
  try {
    let rates: BCVRate | null = null;

    if (source === 'BCV') {
      rates = await fetchBCVRates();
    } else if (source === 'BINANCE') {
      rates = await fetchBinanceRates();
    }

    if (!rates || rates.USD === 0) {
      console.log('⚠️ No valid exchange rates received for', source);
      return;
    }

    const eurToUsd = rates.EUR > 0 && rates.USD > 0 ? rates.EUR / rates.USD : 0;

  // Map our logical source to the Prisma enum (schema uses BCV | CUSTOM | API)
  const dbSource: string = source === 'BINANCE' ? 'API' : source;

    await prisma.exchangeRate.create({
      data: {
        date: new Date(),
        source: dbSource,
        usdToBs: rates.USD,
        eurToBs: rates.EUR,
        eurToUsd: eurToUsd,
        isOfficial: source === 'BCV'
      }
    });

    console.log(`✅ Exchange rates updated (${source}): USD ${rates.USD} | EUR ${rates.EUR}`);
  } catch (error) {
    console.error('❌ Error updating exchange rates:', error);
  }
};

// Helper to check rate freshness (4 hours)
const isRateStale = (rate: any) => {
  if (!rate) return true;
  const fourHours = 4 * 60 * 60 * 1000;
  return (new Date().getTime() - new Date(rate.date).getTime()) > fourHours;
};

/**
 * Obtener la última tasa de cambio
 */
export const getLatestExchangeRate = async (sourceOrId?: string) => {
  try {
    let rate;
    
    // Case 1: Specific Source Request
    if (sourceOrId && ['BCV', 'BCV_OFFICIAL', 'BCV_EUR', 'BINANCE', 'CUSTOM'].includes(sourceOrId)) {
      
      const isBinance = sourceOrId === 'BINANCE';
      const dbSource = isBinance ? 'API' : (sourceOrId.startsWith('BCV') ? 'BCV' : sourceOrId);
      
      // Try to find in DB
      rate = await prisma.exchangeRate.findFirst({ 
          orderBy: { date: 'desc' }, 
          where: { source: dbSource, ...(sourceOrId === 'BCV_OFFICIAL' ? { isOfficial: true } : {}) } 
      });

      // If stale or missing, update from external API (only for BCV/BINANCE)
      if (isRateStale(rate) && (sourceOrId.startsWith('BCV') || isBinance)) {
          const updateType = isBinance ? 'BINANCE' : 'BCV';
          console.log(`⚠️ Rate for ${sourceOrId} is stale or missing. Triggering update...`);
          await updateExchangeRates(updateType);
          
          // Refetch
          rate = await prisma.exchangeRate.findFirst({ 
              orderBy: { date: 'desc' }, 
              where: { source: dbSource, ...(sourceOrId === 'BCV_OFFICIAL' ? { isOfficial: true } : {}) } 
          });
      }
      return rate;
    }

    // Case 2: Specific ID Request (UUID)
    if (sourceOrId) {
       rate = await prisma.exchangeRate.findUnique({ where: { id: sourceOrId } });
       if (rate) return rate;
    }

    // Case 3: Default Request (No args) -> Return Official BCV
    rate = await prisma.exchangeRate.findFirst({ 
        orderBy: { date: 'desc' }, 
        where: { isOfficial: true } 
    });

    if (isRateStale(rate)) {
        console.log(`⚠️ Default BCV rate is stale. Triggering update...`);
        await updateExchangeRates('BCV');
        // Trigger generic background update for others too
        updateExchangeRates('BINANCE').catch(() => {});
        
        rate = await prisma.exchangeRate.findFirst({ 
            orderBy: { date: 'desc' }, 
            where: { isOfficial: true } 
        });
    }

    return rate;
  } catch (error) {
    console.error('❌ Error getting latest exchange rate:', error);
    return null;
  }
};

/**
 * Convertir montos entre monedas
 */
export const convertCurrency = async (
  amount: number,
  fromCurrency: 'BS' | 'USD' | 'EUR',
  toCurrency: 'BS' | 'USD' | 'EUR',
  source?: string
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;

  // source can be a keyword (BCV/BINANCE/CUSTOM) or an exchangeRate id
  const rate = await getLatestExchangeRate(source);
  if (!rate) return 0;

  const usdToBs = Number(rate.usdToBs);
  const eurToBs = Number(rate.eurToBs);
  const eurToUsd = Number(rate.eurToUsd);

  // Convertir todo a Bs primero, luego a la moneda destino
  let amountInBs = amount;

  if (fromCurrency === 'USD') {
    amountInBs = amount * usdToBs;
  } else if (fromCurrency === 'EUR') {
    amountInBs = amount * eurToBs;
  }

  // Convertir de Bs a la moneda destino
  if (toCurrency === 'BS') {
    return amountInBs;
  } else if (toCurrency === 'USD') {
    return amountInBs / usdToBs;
  } else if (toCurrency === 'EUR') {
    return amountInBs / eurToBs;
  }

  return 0;
};

/**
 * Crear tasa personalizada
 */
export const createCustomRate = async (
  usdToBs: number,
  eurToBs: number,
  notes?: string,
  isFallback: boolean = false
) => {
  try {
    const eurToUsd = eurToBs / usdToBs;

    const rate = await prisma.exchangeRate.create({
      data: {
        date: new Date(),
        source: 'CUSTOM',
        usdToBs,
        eurToBs,
        eurToUsd,
        isOfficial: false,
        notes,
        isFallback
      }
    });

    return rate;
  } catch (error) {
    console.error('❌ Error creating custom rate:', error);
    throw error;
  }
};
