import skuSupplierCodes from '@/data/sku_supplier_codes.json';

const skuSupplierCodesMap = (skuSupplierCodes || {}) as Record<string, string>;

export interface LineCodes {
  sku: string;
  supplierCode: string;
}

export function resolveLineCodes(line: any, productsList: any[] = []): LineCodes {
  let sku = (line?.sku || '').trim();
  let supplierCode = (line?.supplierCode || line?.vendorCode || '').trim();

  const pid = line?.productId;
  const name = (line?.name || line?.description || '').trim().toLowerCase();

  // 1. Si no tiene SKU pero tiene productId válido, buscar en productsList
  if (!sku && pid && pid !== 'CUSTOM') {
    const p = productsList.find(prod => String(prod.id) === String(pid));
    if (p) {
      sku = (p.sku || '').trim();
      supplierCode = supplierCode || (p.supplierCode || p.vendorCode || '').trim();
    }
  }

  // 2. Si aún no tiene SKU pero tiene name, buscar por coincidencia en productsList
  if (!sku && name) {
    const p = productsList.find(prod => (prod.name || '').trim().toLowerCase() === name);
    if (p) {
      sku = (p.sku || '').trim();
      supplierCode = supplierCode || (p.supplierCode || p.vendorCode || '').trim();
    }
  }

  // 3. Si tiene SKU pero no tiene supplierCode, deducir según las reglas conocidas
  if (!supplierCode && sku) {
    if (sku.toUpperCase().startsWith('FCS-VIP-')) {
      supplierCode = sku.slice(8); // e.g. FCS-VIP-2551 -> 2551
    } else if (sku.toUpperCase().startsWith('FCS-')) {
      const parts = sku.split('-');
      supplierCode = parts.slice(2).join('-') || parts.pop() || '';
    } else if (skuSupplierCodesMap[sku]) {
      supplierCode = skuSupplierCodesMap[sku];
    }
  }

  // 4. Si aún no tiene supplierCode, buscar en description del producto si contiene "Código Proveedor:"
  if (!supplierCode && (pid || sku || name)) {
    const p = productsList.find(prod => 
      (pid && String(prod.id) === String(pid)) || 
      (sku && (prod.sku || '').toUpperCase() === sku.toUpperCase()) ||
      (name && (prod.name || '').trim().toLowerCase() === name)
    );
    if (p?.description) {
      const match = p.description.match(/C[oó]digo Proveedor:\s*([^|\n\r]+)/i);
      if (match && match[1]) supplierCode = match[1].trim();
    }
  }

  return { sku, supplierCode };
}
