import * as XLSX from 'xlsx';
import formatDateForDisplay from '@/lib/dateUtils';

/**
 * Exportar datos a Excel
 */
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Datos', extraSheet?: { name: string; data: any[] }) => {
  try {
    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    
    // Crear hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Ajustar ancho de columnas automáticamente
    const keys = Object.keys(data[0] || {});
    const colWidths = keys.map(key => ({
      wch: Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      ) + 2,
      // ocultar la columna 'ID Categoría' en la hoja principal si existe
      hidden: key === 'ID Categoría',
    } as any));
    ws['!cols'] = colWidths as any;
    
    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Si se proporcionó una hoja extra (metadatos), crearla y añadirla
    if (extraSheet && Array.isArray(extraSheet.data) && extraSheet.data.length > 0) {
      const metaWs = XLSX.utils.json_to_sheet(extraSheet.data);
      // ajustar anchos simples para metadatos
      const metaKeys = Object.keys(extraSheet.data[0] || {});
      metaWs['!cols'] = metaKeys.map(k => ({ wch: Math.max(k.length, ...extraSheet.data.map(r => String(r[k] || '').length)) + 2 }));
      XLSX.utils.book_append_sheet(wb, metaWs, extraSheet.name);
    }
    
    // Generar archivo y descargar
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    return false;
  }
};

/**
 * Exportar transacciones a Excel
 */
export const exportTransactionsToExcel = (transactions: any[]) => {
  const data = transactions.map(t => ({
    'Código': t.code,
    'Fecha': formatDateForDisplay(t.date),
    'Tipo': t.type,
    'Descripción': t.description,
    'Referencia': t.reference || '',
    'Categoría': t.categoryRef?.name || t.category || '',
    'ID Categoría': t.categoryId || '',
    'Cliente/Proveedor': t.contactPerson?.name || '',
    'Monto': Number(t.amount),
    'Moneda': t.currency,
    'Estado': t.status,
    'Proyecto': t.project?.name || ''
  }));
  
  // Crear hoja de metadatos: mapping de transaction id -> category id/name
  const metadata = transactions.map(t => ({
    'Transaction ID': t.id,
    'ID Categoría': t.categoryId || '',
    'Categoría': t.categoryRef?.name || t.category || '',
  }));

  return exportToExcel(data, 'transacciones', 'Transacciones', { name: 'Metadatos', data: metadata });
};

/**
 * Exportar reportes de contactos a Excel
 */
export const exportContactReportsToExcel = (reports: any[]) => {
  const data = reports.map(r => {
    // compute most frequent category for this contact (prefer normalized name)
    let mostFreqName = '';
    let mostFreqId = '';
    try {
      const counts: Record<string, number> = {};
      const idCounts: Record<string, number> = {};
      for (const t of r.transactions || []) {
        const name = (t?.categoryRef?.name) || t?.category || '';
        const id = t?.categoryId || (t?.categoryRef?.id) || '';
        if (name) counts[name] = (counts[name] || 0) + 1;
        if (id) idCounts[id] = (idCounts[id] || 0) + 1;
      }
      const entries = Object.entries(counts);
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1]);
        mostFreqName = entries[0][0];
      }
      const idEntries = Object.entries(idCounts);
      if (idEntries.length > 0) {
        idEntries.sort((a, b) => b[1] - a[1]);
        mostFreqId = idEntries[0][0];
      }
    } catch (err) {
      // ignore
    }

    return {
      'Contacto': r.contactPerson.name,
      'Tipo': r.contactPerson.type,
      'Categoría': mostFreqName || '',
      'ID Categoría': mostFreqId || '',
      'Email': r.contactPerson.email || '',
      'Teléfono': r.contactPerson.phone || '',
      'Total Ingresos': Number(r.totalIncome),
      'Total Gastos': Number(r.totalExpense),
      'Balance': Number(r.balance),
      'Transacciones': r.transactionCount
    };
  });
  
  return exportToExcel(data, 'reporte_contactos', 'Contactos');
};

/**
 * Exportar a CSV (alternativa ligera)
 */
export const exportToCSV = (data: any[], filename: string) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar');
    }
    
    // Obtener headers
    const headers = Object.keys(data[0]);
    
    // Crear CSV
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar comas y comillas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error exportando a CSV:', error);
    return false;
  }
};
