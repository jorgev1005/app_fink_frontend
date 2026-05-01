import { Request, Response } from 'express';
import prisma from '../config/database';

// Very small heuristic parser for free text to suggest an entry
export const parseEntryText = async (req: Request, res: Response) => {
  try {
    const { text = '' } = req.body;
    const t = (text || '').toString();
    if (!t || t.trim().length === 0) return res.status(400).json({ success: false, error: { message: 'text required' } });

    const lower = t.toLowerCase();

    // Try to detect project from text (by code or name)
    let detectedProjectId: string | undefined;
    let detectedProjectName: string | undefined;

    try {
      // Fetch projects (id, code, name) - usually small list
      const projects = await prisma.project.findMany({ select: { id: true, code: true, name: true } });
      
      // Sort by length descending to match specific names first (e.g. "Project Alpha Beta" before "Project Alpha")
      projects.sort((a, b) => b.name.length - a.name.length);

      for (const p of projects) {
        const code = (p.code || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        
        // Check code match (exact word boundary preferred)
        if (code && new RegExp(`\\b${code}\\b`, 'i').test(t)) {
          detectedProjectId = p.id;
          detectedProjectName = p.name;
          break;
        }
        // Check name match
        if (name && lower.includes(name)) {
          detectedProjectId = p.id;
          detectedProjectName = p.name;
          break;
        }
      }
    } catch (e) {
      console.warn('Error detecting project in parse:', e);
    }

    // Patterns
    const amountRegex = /(-?[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?|-?[0-9]+(?:[.,][0-9]+)?)/g;
    const currencyRegex = /\b(bs|bs\.?|bolivar|bolívares|bsf|vef|usd|eur|€|\$|dólar|dolares|euro|euros)\b/gi;
    const invoiceRegex = /\b(inv[-_\s]?[A-Z0-9]+|factura\s*#?\s*[A-Z0-9-]+)\b/i;
    const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\benero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;

    // Determine mode by keywords (weights increase confidence if matched)
    let mode: 'SMART' | 'TRANSACTION' | 'INVOICE' | 'PAYMENT' = 'SMART';
    if (/(factura|recibo|facturado|facturar)/i.test(t)) mode = 'INVOICE';
    if (/(pago|pagado|transferencia|deposito|abono|pagar)/i.test(t)) mode = 'PAYMENT';
    if (/(compra|gasto|compra de|gasto por|gastos|compra:)/i.test(t)) mode = 'TRANSACTION';

    // Attempt to find currency and amount
    let amount: number | null = null;
    let currency: 'BS' | 'USD' | 'EUR' | null = null;

    const currencyMatch = t.match(currencyRegex);
    if (currencyMatch && currencyMatch.length > 0) {
      const found = currencyMatch[0].toLowerCase();
      if (found.includes('usd') || found.includes('$') || found.includes('dólar') || found.includes('dolar')) currency = 'USD';
      else if (found.includes('eur') || found.includes('€') || found.includes('euro')) currency = 'EUR';
      else currency = 'BS';
    }

    // Extract numeric tokens and parse
    const amountMatches = [...(t.matchAll(amountRegex) || [])].map((m: any) => m[1]);
    const parsedNumbers = amountMatches.map((s: string) => {
      const norm = s.replace(/\./g, '').replace(/,/g, '.');
      const n = Number(norm);
      return Number.isFinite(n) ? n : null;
    }).filter((n): n is number => n !== null);

    if (parsedNumbers.length > 0) {
      // prefer positive numbers; pick the largest absolute value that isn't obviously a year/day
      const candidates = parsedNumbers.filter(n => Math.abs(n) > 0.5);
      if (candidates.length > 0) {
        amount = candidates.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b, candidates[0]);
      } else {
        amount = parsedNumbers[0];
      }
    }

    // invoice code
    const inv = t.match(invoiceRegex);
    const invoiceCode = inv ? inv[0].trim() : null;

    // contact/name naive extraction
    let contactName: string | null = null;
    const contactMatch = t.match(/(?:de|para|a)\s+([A-ZÁÉÍÓÚÑ][a-zA-ZÁÉÍÓÚñáéíóú\s]{2,60})/);
    if (contactMatch) contactName = contactMatch[1].trim();

    // date
    const dateMatch = t.match(dateRegex);
    const date = dateMatch ? dateMatch[0] : undefined;

    // Collect matched rules for explanation
    const matchedRules: string[] = [];
    const breakdown: Record<string, number> = {};

    // Confidence scoring (improved): base + contributions
    let confidence = 0.1;
    if (amount !== null) {
      confidence += 0.45;
      matchedRules.push('amount_detected');
      breakdown.amount = 0.45;
    }
    if (currency) {
      confidence += 0.12;
      matchedRules.push('currency_detected');
      breakdown.currency = 0.12;
    }
    if (invoiceCode) {
      confidence += 0.1;
      matchedRules.push('invoice_code_detected');
      breakdown.invoice = 0.1;
    }
    const keywordMatch = t.match(/\b(total|importe|saldo|subtotal|iva|iva incluido|iva inc|abono|parcial|pago parcial|descuento)\b/i);
    if (keywordMatch) {
      confidence += 0.08;
      matchedRules.push('keyword_context:' + keywordMatch[0].toLowerCase());
      breakdown.keyword = 0.08;
    }
    if (contactName) {
      confidence += 0.04;
      matchedRules.push('contact_detected');
      breakdown.contact = 0.04;
    }
    if (date) {
      confidence += 0.03;
      matchedRules.push('date_detected');
      breakdown.date = 0.03;
    }
    if (detectedProjectId) {
      confidence += 0.15;
      matchedRules.push('project_detected');
      breakdown.project = 0.15;
    }

    // negative indicators (discounts/refunds) reduce confidence for treating number as payable total
    const negativeIndicator = /\b(descuento|reembolso|refinanci|devoluci[oó]n|negativ|-\s?\d+|\(|\))\b/i;
    if (negativeIndicator.test(t)) {
      confidence -= 0.15;
      matchedRules.push('negative_indicator');
      breakdown.negative = -0.15;
    }

    // Detect inline currency formats like USD150 or 150USD or $150
    const inlineCurrency = t.match(/(usd|eur|bs)\s*\d|\$\s*\d|\d\s*(usd|eur|bs)/i);
    if (inlineCurrency) {
      confidence += 0.06;
      matchedRules.push('inline_currency');
      breakdown.inlineCurrency = 0.06;
    }

    // Detect patterns like "subtotal 100, total 150" — prefer the rightmost amount after keywords
    const totals = [...t.matchAll(/\b(total|subtotal|importe|saldo)\b[^0-9\n]{0,6}([0-9.,]+)/gi)];
    if (totals && totals.length > 0) {
      // use the last match as likely total
      const last = totals[totals.length - 1];
      const raw = last[2];
      const norm = raw.replace(/\./g, '').replace(/,/g, '.');
      const n = Number(norm);
      if (Number.isFinite(n)) {
        amount = n;
        matchedRules.push('keyword_total_override');
        breakdown.keywordTotal = 0.12;
        confidence += 0.12;
      }
    }

    if (confidence < 0) confidence = 0.01;
    if (confidence > 0.99) confidence = 0.99;

    const suggestion: any = {
      mode,
      projectId: detectedProjectId,
      projectName: detectedProjectName,
      amount: amount ?? undefined,
      currency: currency ?? (amount ? 'BS' : undefined),
      invoiceCode: invoiceCode ?? undefined,
      contactName: contactName ?? undefined,
      date: date ?? undefined,
      description: t.trim(),
      confidence: Math.round(confidence * 100) / 100,
      matchedRules,
      confidenceBreakdown: breakdown
    };

    res.json({ success: true, data: { suggestion } });
  } catch (error: any) {
    console.error('[parseEntryText] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export default { parseEntryText };
