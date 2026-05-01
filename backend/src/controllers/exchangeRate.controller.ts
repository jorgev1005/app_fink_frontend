import { Request, Response } from 'express';
import { getLatestExchangeRate, createCustomRate as createCustomRateService, updateExchangeRates } from '../services/exchangeRate.service';
import prisma from '../config/database';

export const getLatestRates = async (req: Request, res: Response) => {
  try {
    const rate = await getLatestExchangeRate();

    if (!rate) {
      return res.status(404).json({
        success: false,
        error: { message: 'No hay tasas de cambio disponibles' }
      });
    }

    res.json({
      success: true,
      data: {
        date: rate.date,
        usdToBs: Number(rate.usdToBs),
        eurToBs: Number(rate.eurToBs),
        eurToUsd: Number(rate.eurToUsd),
        source: rate.source,
        isOfficial: rate.isOfficial
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const getRateHistory = async (req: Request, res: Response) => {
  try {
    const { days = 30, source } = req.query;
    const daysNumber = parseInt(days as string);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNumber);

    const whereClause: any = {
      date: { gte: startDate }
    };

    // Filter by source if provided, otherwise default to official (BCV) for backward compatibility
    // unless 'ALL' is specified
    if (source && source !== 'ALL') {
      if (source === 'BCV') {
        whereClause.source = 'BCV';
      } else if (source === 'BINANCE') {
        whereClause.source = 'API'; // Mapped to API in DB
      } else {
        whereClause.source = source;
      }
    } else if (source !== 'ALL') {
      whereClause.isOfficial = true;
    }

    const rates = await prisma.exchangeRate.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }, // Sort ascending for the chart
    });

    res.json({
      success: true,
      data: rates.map(rate => ({
        date: rate.date,
        usdToBs: Number(rate.usdToBs),
        eurToBs: Number(rate.eurToBs),
        source: rate.source === 'API' ? 'BINANCE' : rate.source, // Normalize for frontend
        isOfficial: rate.isOfficial
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const createCustomRate = async (req: Request, res: Response) => {
  try {
    const { usdToBs, eurToBs, notes } = req.body;

    if (!usdToBs || !eurToBs) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requieren las tasas USD y EUR' }
      });
    }

    const rate = await createCustomRateService(usdToBs, eurToBs, notes);

    res.status(201).json({
      success: true,
      data: rate
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};

export const updateRates = async (req: Request, res: Response) => {
  try {
    // Allow source via query or body; default to BCV
    const source = (req.query.source as string) || (req.body?.source as string) || 'BCV';
    if (!['BCV', 'BINANCE', 'CUSTOM'].includes(source)) {
      return res.status(400).json({ success: false, error: { message: 'Fuente inválida' } });
    }

    await updateExchangeRates(source as 'BCV' | 'BINANCE' | 'CUSTOM');

    res.json({ success: true, message: `Exchange rates updated from ${source}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error?.message ?? String(error) } });
  }
};

export const updateAllRates = async (req: Request, res: Response) => {
  try {
    // attempt to update BCV then BINANCE; service handles failures and fallbacks
    const results: Record<string, any> = {};

    try {
      await updateExchangeRates('BCV');
      results.BCV = { success: true };
    } catch (err: any) {
      results.BCV = { success: false, error: err?.message ?? String(err) };
    }

    try {
      await updateExchangeRates('BINANCE');
      results.BINANCE = { success: true };
    } catch (err: any) {
      results.BINANCE = { success: false, error: err?.message ?? String(err) };
    }

    // Ensure there's at least one CUSTOM rate row; if none, try to create from env fallbacks
    try {
      const existingCustom = await prisma.exchangeRate.findFirst({ where: { source: 'CUSTOM' } });
      if (!existingCustom) {
        const fallbackUsd = Number(process.env.FALLBACK_CUSTOM_USD_TO_BS || process.env.FALLBACK_BINANCE_USD_TO_BS || 0);
        const fallbackEur = Number(process.env.FALLBACK_CUSTOM_EUR_TO_BS || process.env.FALLBACK_BCV_EUR_TO_BS || 0);
        if (fallbackUsd > 0) {
          const eurVal = fallbackEur > 0 ? fallbackEur : 0;
          await createCustomRateService(fallbackUsd, eurVal, 'Auto-created fallback custom rate');
          results.CUSTOM = { success: true, created: true };
        } else {
          results.CUSTOM = { success: false, message: 'No fallback CUSTOM rate configured' };
        }
      } else {
        results.CUSTOM = { success: true, created: false };
      }
    } catch (err: any) {
      results.CUSTOM = { success: false, error: err?.message ?? String(err) };
    }

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error?.message ?? String(error) } });
  }
};

export const getLatestRatesBySource = async (req: Request, res: Response) => {
  try {
    const bcv = await getLatestExchangeRate('BCV');
    const binance = await getLatestExchangeRate('BINANCE');
    const custom = await getLatestExchangeRate('CUSTOM');

    const fmt = (r: any) => r ? {
      date: r.date,
      usdToBs: Number(r.usdToBs),
      eurToBs: Number(r.eurToBs),
      eurToUsd: Number(r.eurToUsd),
      source: r.source,
      isOfficial: r.isOfficial,
      isFallback: Boolean(r.isFallback)
    } : null;

    res.json({
      success: true,
      data: {
        BCV: fmt(bcv),
        BINANCE: fmt(binance),
        CUSTOM: fmt(custom)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error?.message ?? String(error) } });
  }
};
