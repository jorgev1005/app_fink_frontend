"use client";
import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle, X, Save } from 'lucide-react';
import api from '@/lib/api';

// Tipos de datos para el importador
type ImportStatus = 'NEW' | 'EXACT_MATCH' | 'POTENTIAL_MATCH' | 'INVALID' | 'VALID';

type ImportedRow = {
  id: string;
  rawDate: string | number;
  date: string; // ISO
  description: string;
  reference: string;
  amount: number; // Positivo = Ingreso, Negativo = Egreso
  type: 'INCOME' | 'EXPENSE';
  
  // Campos para asignar
  projectId?: string;
  categoryId?: string;
  status: ImportStatus;
  validationError?: string;
  duplicateAction?: 'CREATE' | 'UPDATE' | 'SKIP';
  duplicateOriginalId?: string;
  matchReason?: string;
};

type ColumnMapping = {
  date: string;
  description: string;
  reference: string;
  debit: string; // Columna de cargos/retiros
  credit: string; // Columna de abonos/depósitos
  amount: string; // Columna de monto único (si aplica)
  balance: string; // Opcional, para validación
};

export default function BankImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '', description: '', reference: '', debit: '', credit: '', amount: '', balance: ''
  });
  const [numberFormat, setNumberFormat] = useState<'EU' | 'US' | 'EXCEL_BUG'>('EU'); // EU: 1.000,00 | US: 1,000.00 | EXCEL_BUG: 1,62
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY'>('DD/MM/YYYY');
  const [parsedRows, setParsedRows] = useState<ImportedRow[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  
  // Conciliation Stats
  const [reconciliationStats, setReconciliationStats] = useState({
    total: 0,
    new: 0,
    matched: 0,
    potential: 0
  });

  const [viewFilter, setViewFilter] = useState<'ALL' | 'NEW' | 'CONFLICTS'>('ALL');
  
  // Date Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [globalProject, setGlobalProject] = useState('');
  const [globalContact, setGlobalContact] = useState('');

  // Check for duplicates when bank account is selected
  React.useEffect(() => {
    if (!selectedBankAccount || parsedRows.length === 0) return;
    
    const check = async () => {
      setCheckingDuplicates(true);
      try {
        // Fetch recent transactions for this account
        // We'll fetch a broad range based on the import dates
        const dates = parsedRows.map(r => new Date(r.date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Add buffer
        minDate.setDate(minDate.getDate() - 5);
        maxDate.setDate(maxDate.getDate() + 5);

        const res = await api.transactions.getAll({
          accountId: selectedBankAccount,
          startDate: minDate.toISOString(),
          endDate: maxDate.toISOString(),
          limit: 1000
        });
        
        const existing = res.data?.data || [];
        
        let newCount = 0;
        let matchedCount = 0;
        let potentialCount = 0;

        const updatedRows = parsedRows.map(row => {
          // Normalizar para comparación
          const rowDateObj = new Date(row.date);
          const rowAmount = Number(row.amount);
          
          // Buscar coincidencia en DB
          let bestMatch: any = null;
          let matchType: ImportStatus = 'NEW';
          let reason = '';
          
          // 1. Busqueda Exacta: Ref + Monto (Muy fuerte)
          if (row.reference && row.reference.length > 3) {
             const exactRef = existing.find((ex: any) => 
                ex.reference === row.reference && 
                Math.abs(Number(ex.amount) - rowAmount) < 0.01
             );
             if (exactRef) {
                bestMatch = exactRef;
                matchType = 'EXACT_MATCH';
                reason = 'Coincidencia exacta de Referencia y Monto';
             }
          }

          // 2. Si no hay exacta, buscar por Fecha + Monto (Fuerte)
          if (!bestMatch) {
             const exactDateAmount = existing.find((ex: any) => {
                const exDate = new Date(ex.date);
                // Mismo día
                const sameDay = exDate.toISOString().split('T')[0] === rowDateObj.toISOString().split('T')[0];
                return sameDay && Math.abs(Number(ex.amount) - rowAmount) < 0.01;
             });

             if (exactDateAmount) {
                bestMatch = exactDateAmount;
                matchType = 'EXACT_MATCH'; // Asumimos matched si coinciden monto y fecha exacta
                reason = 'Coincidencia de Fecha y Monto exacto';
             }
          }

          // 3. Si aun no, buscar "Potencial" (Fecha Cerca + Monto)
          if (!bestMatch) {
             const potential = existing.find((ex: any) => {
                const exDate = new Date(ex.date);
                const diffTime = Math.abs(exDate.getTime() - rowDateObj.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                // Mismo monto, diferencia de hasta 2 días
                return diffDays <= 2 && Math.abs(Number(ex.amount) - rowAmount) < 0.01;
             });

             if (potential) {
                bestMatch = potential;
                matchType = 'POTENTIAL_MATCH';
                reason = `Monto igual, fecha cercana (${new Date(potential.date).toLocaleDateString()})`;
             }
          }

          if (matchType === 'NEW') newCount++;
          else if (matchType === 'EXACT_MATCH') matchedCount++;
          else potentialCount++;

          return { 
            ...row, 
            status: matchType, 
            duplicateOriginalId: bestMatch?.id,
            duplicateAction: (matchType === 'NEW' ? 'CREATE' : 'SKIP') as 'CREATE' | 'UPDATE' | 'SKIP', // Default action
            matchReason: reason
          };
        });

        setParsedRows(updatedRows);
        setReconciliationStats({
          total: parsedRows.length,
          new: newCount,
          matched: matchedCount,
          potential: potentialCount
        });

      } catch (e) {
        console.error('Error checking duplicates', e);
      } finally {
        setCheckingDuplicates(false);
      }
    };
    
    check();
  }, [selectedBankAccount]);

  // Cargar proyectos y cuentas al inicio
  React.useEffect(() => {
    api.projects.getAll().then(r => setProjects(r.data.data || [])).catch(() => {});
    api.contacts.getAll().then(r => setContacts(r.data.data || [])).catch(() => {});
    // Cargar todas las cuentas (idealmente filtrar por bancos)
    api.accounts.getAll().then(r => {
       const all = r.data.data || [];
       // Filtrar solo bancos/caja
       const banks = all.filter((a: any) => 
         (a.type === 'ASSET' && (a.subType === 'BANK' || a.subType === 'CASH')) || 
         a.name.toLowerCase().includes('banco') || 
         a.name.toLowerCase().includes('caja')
       );
       setAccounts(banks);
    }).catch(() => {});
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string;
      
      const isCSV = f.name.toLowerCase().endsWith('.csv');
      // Forzamos raw: true para evitar que XLSX pre-parsee strings en floats equivocadamente con locales en ingles.
      const wb = XLSX.read(bstr, { type: 'binary', raw: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // raw: true permite obtener fechas como Serial Number y montos como Number en XLSX
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[];
      
      if (data.length > 0) {
        // Intentar encontrar la fila de cabecera (la que tiene más strings)
        let headerRowIndex = 0;
        let maxStrings = 0;
        
        data.slice(0, 10).forEach((row: any, idx) => {
          const strCount = row.filter((c: any) => typeof c === 'string').length;
          if (strCount > maxStrings) {
            maxStrings = strCount;
            headerRowIndex = idx;
          }
        });

        let detectedHeaders = (data[headerRowIndex] as any[]).map(h => String(h || '').trim());
        let startIndex = headerRowIndex + 1;

        // Heurística: Si la primera "cabecera" parece una fecha o un número, probablemente no hay cabecera
        const firstHeader = detectedHeaders[0];
        const looksLikeDate = firstHeader.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
        const looksLikeNumber = !isNaN(parseFloat(firstHeader)) && isFinite(parseFloat(firstHeader));
        
        // Si parece datos y NO tiene palabras clave de cabecera
        const hasHeaderKeywords = detectedHeaders.some(h => 
          ['fecha', 'date', 'descrip', 'monto', 'amount', 'saldo', 'balance', 'ref'].some(k => h.toLowerCase().includes(k))
        );

        if ((looksLikeDate || looksLikeNumber) && !hasHeaderKeywords) {
           // Asumir que no hay cabecera
           detectedHeaders = detectedHeaders.map((_, i) => `Columna ${i + 1}`);
           startIndex = headerRowIndex; // Incluir la fila detectada como datos
        }

        setHeaders(detectedHeaders);
        setRawData(data.slice(startIndex));
        
        // Intentar auto-mapear columnas comunes
        const newMap = { ...mapping };
        detectedHeaders.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('fecha') || lower.includes('date')) newMap.date = h;
          if (lower.includes('descrip') || lower.includes('detalle') || lower.includes('concepto')) newMap.description = h;
          if (lower.includes('ref') || lower.includes('doc')) newMap.reference = h;
          if (lower.includes('cargo') || lower.includes('retiro') || lower.includes('debe') || lower.includes('egreso')) newMap.debit = h;
          if (lower.includes('abono') || lower.includes('deposito') || lower.includes('haber') || lower.includes('ingreso')) newMap.credit = h;
          if (lower.includes('monto') || lower.includes('importe')) newMap.amount = h;
        });
        setMapping(newMap);
        setStep(2);
      }
    };
    reader.readAsBinaryString(f);
  };

  const parseDate = (val: any): string => {
    let d = new Date(); // Default fallback

    if (!val) return d.toISOString();
    
      // 1. Excel Serial Number
      if (typeof val === 'number') {
        const baseDate = new Date(1899, 11, 30);
        // Use Round instead of Floor because 46054.999 is effectively the next day
        // Excel floating point precision often results in .9999 for midnight depending on how it was generated
        const days = Math.round(val);
        
        // Add days to base
        d = new Date(baseDate.getTime() + days * 86400000);
        
        // Adjust timezone offset so that we get the correct UTC date representation
        // (Serial dates are ostensibly local time, so we shift to keep the visual day)
        const userTimezoneOffset = d.getTimezoneOffset() * 60000;
        d = new Date(d.getTime() + userTimezoneOffset);
        
        // Force noon to avoid timezone shifts
        d.setHours(12, 0, 0, 0);
        return d.toISOString();
      }

      // 2. String handling
      let str = String(val).trim();
      
      // Clean potential invisible characters or quotes
      str = str.replace(/['"]/g, '').trim();

      // Robust Split based on selected format
      const parts = str.split(/[\/\-\.]/);
      
      if (parts.length >= 3) {
        let day, month, year;
        
        // Parse parts without assigning logic yet
        let p0 = parseInt(parts[0], 10);
        let p1 = parseInt(parts[1], 10);
        let p2 = parseInt(parts[2], 10);

        // Check for 2-digit years in first position (YY/MM/DD) - unlikely for banks but possible
        // Check for 4-digit years in first position (YYYY/MM/DD) - ISO
        if (p0 > 1000) {
           year = p0;
           month = p1 - 1;
           day = p2;
        } else {
            // Check if format is overridden by User
            if (dateFormat === 'MM/DD/YYYY') {
              month = p0 - 1;
              day = p1;
            } else {
              // Default DD/MM/YYYY
              day = p0;
              month = p1 - 1;
            }
            year = p2;
        }
        
        // Handle 2-digit years
        if (year < 100) year += 2000;

        // Construct date at NOON to avoid timezone jumping
        d = new Date(year, month, day, 12, 0, 0);
      } else {
        // Fallback
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
          d = parsed;
          d.setHours(12, 0, 0, 0);
        }
      }

    return d.toISOString();
  };

  const parseAmount = (val: any): number => {
    // Si el usuario marcó explícitamente "Error Excel", significa que los grandes montos
    // (ej. 1.617 o 101.527) se leyeron literalmente como decimales pequeños (-1.617). 
    // Para repararlo por completo ignorando toda la auto-lógica:
    if (numberFormat === 'EXCEL_BUG') {
      const parsedFloat = parseFloat(String(val).replace(/,/g, ''));
      if (isNaN(parsedFloat)) return 0;
      return parsedFloat * 1000;
    }

    let num = 0;
    if (typeof val === 'number') {
       num = val;
    } else {
      if (!val) return 0;
      let str = String(val).trim();

      // Limpiar caracteres invisibles o extraños
      str = str.replace(/[^\d.,\-+]/g, '');

        let forcedFormat = numberFormat;
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');

        // Auto-detect unambiguous format when both separators exist
        if (lastComma > -1 && lastDot > -1) {
           if (lastComma > lastDot) {
              forcedFormat = 'EU'; // e.g. 1.000,00
           } else {
              forcedFormat = 'US'; // e.g. 1,000.00
           }
        } else if (lastComma > -1 && lastDot === -1) {
           // Auto-detect if it's the only separator and clearly a decimal
           const parts = str.split(',');
           const afterComma = parts[parts.length - 1];
           if (afterComma.length === 1 || afterComma.length === 2) {
               forcedFormat = 'EU'; // e.g. 1000,00 -> comma is decimal
           }
        } else if (lastDot > -1 && lastComma === -1) {
           const parts = str.split('.');
           const afterDot = parts[parts.length - 1];
           if (afterDot.length === 1 || afterDot.length === 2) {
               forcedFormat = 'US'; // e.g. 1000.00 -> dot is decimal
           }
        }

        if (forcedFormat === 'EU') {
             // Formato Europeo: 1.000,00 -> Eliminar puntos, reemplazar coma por punto
             str = str.replace(/\./g, 'TEMP').replace(/,/g, '.').replace(/TEMP/g, '');
          } else {
             // Formato Americano: 1,000.00 -> Eliminar comas
             str = str.replace(/,/g, '');
          }

        num = parseFloat(str);
    }
    
    if (isNaN(num)) return 0;
    
    // Si Excel importó los números en formato local causando división x 1000, el usuario lo corrige:
    if (false) {
       num = num * 1000;
    }
    
    return num;
  };
    const processData = () => {
      const rows: ImportedRow[] = [];
    const dateIdx = headers.indexOf(mapping.date);
    const descIdx = headers.indexOf(mapping.description);
    const refIdx = headers.indexOf(mapping.reference);
    const debitIdx = headers.indexOf(mapping.debit);
    const creditIdx = headers.indexOf(mapping.credit);
    const amtIdx = headers.indexOf(mapping.amount);

    rawData.forEach((row: any, idx) => {
      // Si la fila está vacía, saltar
      if (row.length === 0) return;

      const rawDate = row[dateIdx];
      const desc = row[descIdx] ? String(row[descIdx]) : 'Sin descripción';
      const ref = row[refIdx] ? String(row[refIdx]) : '';
      
      let amount = 0;
      let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

      // Lógica de montos: Columnas separadas vs Columna única con signo
      if (debitIdx >= 0 && creditIdx >= 0) {
        const debit = parseAmount(row[debitIdx]);
        const credit = parseAmount(row[creditIdx]);
        
        if (credit > 0) {
          amount = credit;
          type = 'INCOME';
        } else if (debit > 0 || debit < 0) { // Debit puede venir negativo o positivo
          amount = Math.abs(debit);
          type = 'EXPENSE';
        }
      } else if (amtIdx >= 0) {
        const val = parseAmount(row[amtIdx]);
        amount = Math.abs(val);
        type = val >= 0 ? 'INCOME' : 'EXPENSE';
      }

      if (amount > 0) {
        rows.push({
          id: Math.random().toString(36).substr(2, 9),
          rawDate,
          date: parseDate(rawDate),
          description: desc,
          reference: ref,
          amount,
          type,
          status: 'VALID'
        });
      }
    });

    setParsedRows(rows);
    
    // Set default date filters based on data range
    if (rows.length > 0) {
       const dates = rows.map(r => new Date(r.date).getTime());
       const min = new Date(Math.min(...dates));
       const max = new Date(Math.max(...dates));
       setFilterStartDate(min.toISOString().split('T')[0]);
       setFilterEndDate(max.toISOString().split('T')[0]);
    }
    
    setStep(3);
  };

  const getFilteredRows = () => {
    return parsedRows.filter(r => {
      const d = r.date.split('T')[0];
      if (filterStartDate && d < filterStartDate) return false;
      if (filterEndDate && d > filterEndDate) return false;

      if (viewFilter === 'NEW') return r.status === 'NEW' || r.status === 'VALID';
      if (viewFilter === 'CONFLICTS') return r.status === 'EXACT_MATCH' || r.status === 'POTENTIAL_MATCH';

      return true;
    });
  };

  const processImport = async () => {
    if (!selectedBankAccount) {
      alert('Por favor selecciona la cuenta bancaria a la que pertenecen estos movimientos.');
      return;
    }

    // We process ALL rows currently visible in the filter, but only those marked for CREATE/UPDATE
    // Actually, usually we want to process EVERYTHING that is valid, regardless of view filter.
    // But safely, let's process everything that is NOT 'SKIP'.
    // However, the user might have filtered by date. So we should respect date filter.
    
    // Let's get "All rows in date range" first
    const rowsInDateRange = parsedRows.filter(r => {
      const d = r.date.split('T')[0];
      if (filterStartDate && d < filterStartDate) return false;
      if (filterEndDate && d > filterEndDate) return false;
      return true;
    });

    const validRows = rowsInDateRange.filter(r => r.projectId && r.duplicateAction !== 'SKIP'); 
    
    if (validRows.length === 0) {
      alert('No hay transacciones válidas para importar (verifique que tengan proyecto asignado y no estén marcadas como Omitir).');
      return;
    }

    if (!confirm(`Se procesarán ${validRows.length} transacciones. ¿Continuar?`)) return;

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    try {
      // Procesar en serie para no saturar
      for (const row of validRows) {
        try {
          // Si es UPDATE, llamamos al endpoint de actualizar
          if (row.duplicateAction === 'UPDATE' && row.duplicateOriginalId) {
             const payload = {
                description: row.description,
                reference: row.reference,
                projectId: row.projectId,
                // No actualizamos monto/fecha para no romper conciliación, pero se podría
             };
             await api.transactions.update(row.duplicateOriginalId, payload);
             successCount++;
             continue;
          }

          // Determinar cuentas según tipo
          // Si es INGRESO: Debit = Banco, Credit = Ingreso (o cuenta por defecto del proyecto)
          // Si es EGRESO: Debit = Gasto (o cuenta por defecto), Credit = Banco
          
          // Buscar cuenta de contrapartida (simple heuristic: primera cuenta de ingreso/gasto del proyecto)
          // Nota: Esto es una simplificación. Idealmente el usuario debería poder seleccionar la categoría/cuenta específica.
          // Por ahora usaremos una cuenta genérica del proyecto si no se especifica categoría.
          
          // Para MVP: Usamos la cuenta bancaria seleccionada y dejamos la contrapartida "por definir" o buscamos una por defecto.
          // Como la API requiere debitAccountId y creditAccountId, necesitamos resolverlas.
          
          // Fetch accounts for the project to find a default counterpart
          const projAccountsRes = await api.accounts.getAll({ projectId: row.projectId });
          const projAccounts = projAccountsRes.data?.data || [];
          
          let counterpartId = '';
          if (row.type === 'INCOME') {
             const rev = projAccounts.find((a: any) => a.type === 'REVENUE' || a.type === 'INCOME');
             counterpartId = rev?.id || projAccounts[0]?.id;
          } else {
             const exp = projAccounts.find((a: any) => a.type === 'EXPENSE');
             counterpartId = exp?.id || projAccounts[0]?.id;
          }

          if (!counterpartId) {
             const msg = `El proyecto seleccionado no tiene cuentas configuradas (Ingresos/Gastos).`;
             console.warn(`No se encontró cuenta de contrapartida para proyecto ${row.projectId}`);
             if (!errorMessages.includes(msg)) errorMessages.push(msg);
             errorCount++;
             continue;
          }

          // Validación de contacto
          if ((row.type === 'INCOME' || row.type === 'EXPENSE') && !globalContact) {
             const msg = `Se requiere un contacto (Cliente/Proveedor) por defecto para transacciones de tipo ${row.type}. Por favor selecciona uno arriba.`;
             if (!errorMessages.includes(msg)) errorMessages.push(msg);
             errorCount++;
             continue;
          }

          const payload = {
            mode: 'TRANSACTION',
            projectId: row.projectId,
            contactPersonId: globalContact || undefined, // Asignar contacto por defecto
            type: row.type,
            description: row.description,
            reference: row.reference,
            date: row.date,
            amount: row.amount,
            currency: 'BS', // Asumimos BS por defecto para bancos nacionales, podría ser parametrizable
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            entries: [
              {
                debitAccountId: row.type === 'INCOME' ? selectedBankAccount : counterpartId,
                debitAmount: row.amount,
                creditAccountId: null,
                creditAmount: 0,
                description: row.description
              },
              {
                debitAccountId: null,
                debitAmount: 0,
                creditAccountId: row.type === 'INCOME' ? counterpartId : selectedBankAccount,
                creditAmount: row.amount,
                description: row.description
              }
            ]
          };

          await api.transactions.create(payload);
          successCount++;
        } catch (e: any) {
          console.error('Error importando fila', row, e);
          const msg = e.response?.data?.message || e.message || 'Error desconocido';
          if (errorMessages.length < 5) errorMessages.push(`Fila ${row.description}: ${msg}`);
          errorCount++;
        }
      }

      let msg = `Importación finalizada.\nExitosos: ${successCount}\nErrores: ${errorCount}`;
      if (errorMessages.length > 0) {
         msg += `\n\nDetalles de errores:\n- ${errorMessages.join('\n- ')}`;
      }
      alert(msg);
      
      if (successCount > 0) {
         window.location.href = '/transactions';
      }

    } catch (e) {
      alert('Error general en la importación');
    } finally {
      setImporting(false);
    }
  };

  // --- RENDERERS ---

  if (step === 1) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
        <input 
          type="file" 
          accept=".xlsx,.xls,.csv" 
          onChange={handleFileUpload} 
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <Upload className="w-16 h-16 text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-700">Arrastra tu archivo Excel aquí</h3>
        <p className="text-slate-500 mt-2">Soporta Banesco, Mercantil, Venezuela, etc.</p>
        <button className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">Seleccionar Archivo</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Configurar Columnas</h3>
        <p className="text-sm text-slate-500 mb-6">Ayúdanos a entender el formato de tu archivo. Selecciona qué columna corresponde a cada dato.</p>
        
        {/* Data Preview */}
        <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Vista Previa del Primer Registro (Ayuda para identificar columnas):</h4>
          <div className="overflow-x-auto">
            <table className="text-xs text-left w-full bg-white rounded border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  {headers.map((h, i) => (
                    <th key={i} className="p-2 font-medium text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {rawData.length > 0 && headers.map((_, i) => (
                    <td key={i} className="p-2 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-0">
                      {String(rawData[0][i] || '')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Columna Fecha</label>
            <select className="w-full p-2 border rounded-lg" value={mapping.date} onChange={e => setMapping({...mapping, date: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Columna Descripción</label>
            <select className="w-full p-2 border rounded-lg" value={mapping.description} onChange={e => setMapping({...mapping, description: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Columna Referencia</label>
            <select className="w-full p-2 border rounded-lg" value={mapping.reference} onChange={e => setMapping({...mapping, reference: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-8">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">¿Cómo están los montos?</h4>
          
          {/* Number and Date Format Selectors */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Number Format */}
             <div className="p-2 bg-white rounded border border-blue-200">
               <label className="block text-xs font-medium text-slate-600 mb-1">Formato de Números</label>
               <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                       type="radio" 
                       name="numFormat" 
                       checked={numberFormat === 'EU'} 
                       onChange={() => setNumberFormat('EU')}
                     />
                     <span className="text-sm">1.000,00 (EU)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                       type="radio" 
                       name="numFormat" 
                       checked={numberFormat === 'US'} 
                       onChange={() => setNumberFormat('US')}
                     />
                     <span className="text-sm">1,000.00 (US)</span>
                  </label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" 
                       name="dateFormat" 
                       checked={dateFormat === 'DD/MM/YYYY'} 
                       onChange={() => setDateFormat('DD/MM/YYYY')}
                     />
                     <span className="text-sm">Día/Mes/Año</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                       type="radio" 
                       name="dateFormat" 
                       checked={dateFormat === 'MM/DD/YYYY'} 
                       onChange={() => setDateFormat('MM/DD/YYYY')}
                     />
                     <span className="text-sm">Mes/Día/Año</span>
                  </label>
               </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">Opción A: Columnas Separadas (Debe/Haber)</label>
                <div className="flex gap-2">
                  <select className="w-full p-2 border rounded-lg text-sm" value={mapping.debit} onChange={e => setMapping({...mapping, debit: e.target.value, amount: ''})}>
                    <option value="">Columna Cargos/Retiros</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select className="w-full p-2 border rounded-lg text-sm" value={mapping.credit} onChange={e => setMapping({...mapping, credit: e.target.value, amount: ''})}>
                    <option value="">Columna Abonos/Depósitos</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
             </div>
             <div className="flex items-center justify-center text-blue-400 font-bold">O</div>
             <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">Opción B: Una sola columna (+/-)</label>
                <select className="w-full p-2 border rounded-lg text-sm" value={mapping.amount} onChange={e => setMapping({...mapping, amount: e.target.value, debit: '', credit: ''})}>
                    <option value="">Columna Monto</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
             </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Atrás</button>
          <button onClick={processData} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2">
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
  const filteredRows = getFilteredRows();
  
  return (
    <div className="p-6">
      {/* 1. Dashboard de Conciliación */}
      <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               Resumen de Conciliación: <span className="text-blue-600 font-mono">{file?.name}</span>
               {checkingDuplicates && <span className="text-xs font-normal text-blue-600 animate-pulse">(Analizando...)</span>}
            </h3>
            <div className="flex gap-2 text-xs">
                {/* Filters */}
                <button 
                  onClick={() => setViewFilter('ALL')}
                  className={`px-3 py-1 rounded-full border ${viewFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600'}`}
                >
                  Todos ({reconciliationStats.total})
                </button>
                <button 
                  onClick={() => setViewFilter('NEW')}
                  className={`px-3 py-1 rounded-full border ${viewFilter === 'NEW' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600'}`}
                >
                  Nuevos ({reconciliationStats.new})
                </button>
                <button 
                  onClick={() => setViewFilter('CONFLICTS')}
                  className={`px-3 py-1 rounded-full border ${viewFilter === 'CONFLICTS' ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-yellow-600'}`}
                >
                  Conflictos ({reconciliationStats.potential + reconciliationStats.matched})
                </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-semibold">Total Registros</p>
                <p className="text-2xl font-bold text-slate-800">{reconciliationStats.total}</p>
             </div>
             
             {/* Nuevos */}
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-blue-600 uppercase font-semibold">Nuevos</p>
                    <p className="text-2xl font-bold text-blue-700">{reconciliationStats.new}</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Check size={16} />
                  </div>
                </div>
                <p className="text-xs text-blue-600/80 mt-1">Listos para importar</p>
             </div>

             {/* Potenciales */}
             <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-yellow-600 uppercase font-semibold">Posibles Duplicados</p>
                    <p className="text-2xl font-bold text-yellow-700">{reconciliationStats.potential}</p>
                  </div>
                  <div className="p-2 bg-yellow-100 rounded-full text-yellow-600">
                    <AlertCircle size={16} />
                  </div>
                </div>
                <p className="text-xs text-yellow-600/80 mt-1">Requieren revisión</p>
             </div>

             {/* Exactos */}
             <div className="bg-green-50 p-4 rounded-lg border border-green-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-green-600 uppercase font-semibold">Ya Registrados</p>
                    <p className="text-2xl font-bold text-green-700">{reconciliationStats.matched}</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <Check size={16} />
                  </div>
                </div>
                <p className="text-xs text-green-600/80 mt-1">Se omitirán automáticamente</p>
             </div>
         </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h3 className="text-lg font-semibold">Detalle de Movimientos</h3>
           <p className="text-sm text-slate-500">Revisa la lista filtrada abajo antes de proceder.</p>
        </div>
        
        <div className="flex flex-col gap-2 w-full md:w-auto">
           {/* Date Filters */}
           <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">Rango:</span>
              <input 
                type="date" 
                className="text-xs p-1 border rounded bg-white"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
              />
              <span className="text-xs text-slate-400">-</span>
              <input 
                type="date" 
                className="text-xs p-1 border rounded bg-white"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
              />
           </div>

           <div className="flex gap-2">
              <select 
                className="p-2 border rounded-lg text-sm flex-1"
                value={selectedBankAccount}
                onChange={e => setSelectedBankAccount(e.target.value)}
              >
                <option value="">-- Selecciona Cuenta Bancaria (Origen) --</option>
                {accounts.map(a => {
                  const proj = projects.find(p => p.id === a.projectId);
                  const projName = proj ? proj.name : 'Sin Proyecto Asignado';
                  return (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}) — [{projName}]
                    </option>
                  );
                })}
              </select>
           </div>
           <div className="flex gap-2">
              <select
                className="p-2 border rounded-lg text-sm flex-1"
                value={globalContact}
                onChange={e => setGlobalContact(e.target.value)}
              >
                <option value="">-- Contacto por Defecto (Clientes/Prov) --</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
              <select 
                className="p-2 border rounded-lg text-sm flex-1"
                value={globalProject}
                onChange={e => {
                  setGlobalProject(e.target.value);
                  if (e.target.value) {
                     setParsedRows(prev => prev.map(r => ({ ...r, projectId: e.target.value })));
                  }
                }}
              >
                <option value="">Asignar Proyecto a Todos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button 
                onClick={processImport} 
                disabled={importing || !selectedBankAccount}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {importing ? 'Importando...' : <><Save className="w-4 h-4" /> Ejecutar Importación</>}
              </button>
           </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-xl max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm text-left relative">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Descripción</th>
              <th className="p-3">Ref</th>
              <th className="p-3 text-right">Monto</th>
              <th className="p-3">Proyecto</th>
              <th className="p-3">Estado / Acción</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRows.map((row, idx) => {
              // Determine row style based on reconciliation status
              let rowClass = "hover:bg-slate-50";
              if (row.status === 'EXACT_MATCH') rowClass = "bg-slate-100 opacity-75"; // Dimmed because likely skipped
              if (row.status === 'POTENTIAL_MATCH') rowClass = "bg-amber-50";
              if (row.status === 'NEW' || row.status === 'VALID') rowClass = "bg-white";

              return (
              <tr key={row.id} className={rowClass}>
                <td className="p-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    {/* Force manual DD/MM/YYYY formatting to avoid locale ambiguity */}
                    <span className="font-mono">
                      {(() => {
                        const d = new Date(row.date);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                      })()}
                    </span>
                    {row.matchReason && <span className="text-[10px] text-slate-500 font-mono">{row.matchReason}</span>}
                  </div>
                </td>
                <td className="p-3 max-w-[300px] truncate" title={row.description}>{row.description}</td>
                <td className="p-3">
                   <div className="flex flex-col">
                     <span>{row.reference}</span>
                     {row.duplicateOriginalId && (
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded w-fit">Ref ID: {row.duplicateOriginalId.slice(0,8)}...</span>
                     )}
                   </div>
                </td>
                <td className={`p-3 text-right font-medium ${row.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                  {(() => {
                    // Formato europeo: separador de miles punto, decimal coma
                    const absAmount = Math.abs(row.amount);
                    const parts = absAmount.toFixed(2).split('.');
                    let intPart = parts[0];
                    let decPart = parts[1];
                    // Agregar puntos como separador de miles
                    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                    return `${row.type === 'INCOME' ? '+' : '-'}${intPart},${decPart}`;
                  })()}
                </td>
                <td className="p-3">
                  <select 
                    className="w-full p-1 border rounded text-xs bg-white"
                    value={row.projectId || ''}
                    disabled={row.duplicateAction === 'SKIP'}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Update in the main list, finding by ID
                      setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, projectId: val } : r));
                    }}
                  >
                    <option value="">--</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className="p-3">
                   {/* Reconciliation Actions */}
                   {(row.status === 'NEW' || row.status === 'VALID') && (
                      <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100 w-fit">
                         <Check size={12} />
                         <span className="text-xs font-bold">Nuevo</span>
                      </div>
                   )}

                   {row.status === 'EXACT_MATCH' && (
                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-1 text-slate-600 bg-slate-200 px-2 py-1 rounded border border-slate-300 w-fit">
                            <Check size={12} />
                            <span className="text-xs font-bold">Ya Existe</span>
                         </div>
                         <div className="flex gap-1 text-[10px]">
                           <button 
                             onClick={() => setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, duplicateAction: 'SKIP' } : r))}
                             className={`px-1 rounded ${row.duplicateAction === 'SKIP' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                           >Omitir</button>
                           <button 
                             onClick={() => setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, duplicateAction: 'CREATE' } : r))}
                             className={`px-1 rounded ${row.duplicateAction === 'CREATE' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                           >Duplicar</button>
                         </div>
                      </div>
                   )}

                   {row.status === 'POTENTIAL_MATCH' && (
                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded border border-yellow-200 w-fit">
                            <AlertCircle size={12} />
                            <span className="text-xs font-bold">Posible Duplicado</span>
                         </div>
                         <div className="text-[10px] text-slate-500 leading-tight mb-1">
                            {row.matchReason}
                         </div>
                         <select 
                            className="w-full text-[10px] p-1 border rounded"
                            value={row.duplicateAction}
                            onChange={(e) => setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, duplicateAction: e.target.value as any } : r))}
                         >
                            <option value="SKIP">⚠️ Omitir (Seguro)</option>
                            <option value="CREATE">✅ Importar como nuevo</option>
                         </select>
                      </div>
                   )}
                </td>
                <td className="p-3 text-center">
                  <button 
                    onClick={() => setParsedRows(prev => prev.filter(r => r.id !== row.id))}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

  return null;
}



