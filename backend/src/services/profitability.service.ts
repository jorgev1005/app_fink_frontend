import prisma from '../config/database';
import { getLatestExchangeRate } from './exchangeRate.service';

/**
 * Calculates and records the total cost and net profit of a sales invoice.
 * Net profit is calculated as: Net Invoice Total (excluding tax/VAT) - Total Cost.
 * Service SKUs (starting with 'SRV-') default to 0 cost.
 * Converts product costs to invoice currency if they differ.
 */
export async function calculateInvoiceProfitability(invoiceId: string, txInput?: any) {
  const tx = txInput || prisma;
  
  // 1. Fetch the invoice
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    console.warn(`[ProfitabilityService] Invoice with ID ${invoiceId} not found.`);
    return;
  }

  // Profitability tracking only applies to sales invoices (INVOICE type)
  if (invoice.type !== 'INVOICE') {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        totalCost: 0,
        netProfit: 0
      }
    });
    return { totalCost: 0, netProfit: 0 };
  }

  // 2. Parse invoice lines to extract items and taxAmount
  let items: any[] = [];
  let taxAmount = 0;
  
  try {
    if (invoice.lines) {
      const parsed = typeof invoice.lines === 'string' ? JSON.parse(invoice.lines) : invoice.lines;
      if (parsed) {
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (typeof parsed === 'object') {
          if (parsed.items && Array.isArray(parsed.items)) {
            items = parsed.items;
          }
          taxAmount = Number(parsed.taxAmount) || 0;
        }
      }
    }
  } catch (error) {
    console.error(`[ProfitabilityService] Error parsing lines for invoice ${invoice.code}:`, error);
  }

  let totalCost = 0;

  if (items.length > 0) {
    // Extract unique product IDs for batch retrieval, excluding 'CUSTOM'
    const productIds = Array.from(new Set(
      items
        .map(item => item.productId)
        .filter(id => id && id !== 'CUSTOM')
    ));

    const products = productIds.length > 0
      ? await tx.product.findMany({ where: { id: { in: productIds } } })
      : [];

    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

    // Fetch latest exchange rate from the database (fast, database-only query to avoid transaction timeout)
    const rateRecord = await tx.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
    const usdToBs = rateRecord ? Number(rateRecord.usdToBs) : 1;

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const sku = (item.sku || '').toUpperCase();

      // Service SKUs default to 0 cost price
      if (sku.startsWith('SRV-')) {
        continue;
      }

      let costPrice = 0;
      let packagingCost = 0;
      let productCurrency = 'USD';

      if (item.productId && item.productId !== 'CUSTOM') {
        const dbProduct = productMap.get(item.productId) as any;
        if (dbProduct) {
          costPrice = Number(dbProduct.costPrice) || 0;
          packagingCost = Number(dbProduct.packagingCost) || 0;
          productCurrency = dbProduct.currency || 'USD';
        }
      }

      // Sum base cost and packaging cost
      const itemUnitCost = costPrice + packagingCost;
      let itemUnitCostInInvoiceCurrency = itemUnitCost;

      // Convert currency if it differs from the invoice currency
      if (productCurrency !== invoice.currency) {
        if (productCurrency === 'USD' && invoice.currency === 'BS') {
          itemUnitCostInInvoiceCurrency = itemUnitCost * usdToBs;
        } else if (productCurrency === 'BS' && invoice.currency === 'USD') {
          itemUnitCostInInvoiceCurrency = usdToBs > 0 ? itemUnitCost / usdToBs : 0;
        }
      }

      totalCost += itemUnitCostInInvoiceCurrency * quantity;
    }
  }

  // Net Profit = Net Invoice Total (excluding tax/VAT) - Total Cost
  const netInvoiceTotal = Math.max(0, Number(invoice.total) - taxAmount);
  const netProfit = netInvoiceTotal - totalCost;

  // 3. Save the results back to the invoice
  const updatedInvoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      totalCost,
      netProfit
    }
  });

  console.log(`[ProfitabilityService] Success calculating for ${invoice.code}: totalCost=${totalCost.toFixed(2)}, netProfit=${netProfit.toFixed(2)} (${invoice.currency})`);
  return { totalCost, netProfit };
}
