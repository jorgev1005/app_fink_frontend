
import { Request, Response } from 'express';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

// Helper to extract data using regex
// Improved version of the one in attachments.service.ts
function parseInvoiceText(text: string) {
  // Normalize text
  const cleaned = text.replace(/\r\n/g, '\n');
  const lines = cleaned.split('\n');

  let totalAmount: number | null = null;
  let date: string | null = null;
  let invoiceNumber: string | null = null;
  let nif: string | null = null;

  // 1. Find DATE (DD/MM/YYYY or YYYY-MM-DD)
  // Look for Common labels: FECHA, DATE, EMISION
  const dateRegex = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/;
  for (const line of lines) {
    if (line.match(/fecha|date|emisi[oó]n/i)) {
      const match = line.match(dateRegex);
      if (match) {
        date = match[0];
        break; // Assume first date found near "Fecha" is the one
      }
    }
  }
  // Fallback: just search for any date
  if (!date) {
    const match = cleaned.match(dateRegex);
    if (match) date = match[0];
  }

  // 2. Find TOTAL AMOUNT
  // Look for largest number after "TOTAL", "MONTO", "PAGAR"
  // This is tricky. Often the Total is at the bottom.
  // We'll look for lines containing "Total" and a number
  const amountRegex = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;
  
  const possibleAmounts: number[] = [];

  for (const line of lines) {
    // Regex for money: 1.234,56 or 1,234.56 or 123.45
    // Catch numbers that look like prices
    const matches = line.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g);
    for (const m of matches) {
        // Cleaning: remove non-numeric except dot and comma
        let valStr = m[0].replace(/[^\d.,]/g, '');
        // Guess format: if comma is last separator, it's decimal (ES/DE). If dot is last, it's decimal (US/UK)
        // Heuristic: if last punctuation is ',', replace '.' with '' and ',' with '.'
        const lastDot = valStr.lastIndexOf('.');
        const lastComma = valStr.lastIndexOf(',');
        
        if (lastComma > lastDot) {
            // Likely 1.234,56 -> 1234.56
            valStr = valStr.replace(/\./g, '').replace(',', '.');
        } else {
             // Likely 1,234.56 -> 1234.56
            valStr = valStr.replace(/,/g, '');
        }
        
        const val = parseFloat(valStr);
        if (!isNaN(val)) possibleAmounts.push(val);
    }
  }

  // If we found "Total", prioritize numbers near it
  const totalLines = lines.filter(l => l.match(/total|pagar|neto/i));
  let totalCandidates: number[] = [];
  
  if (totalLines.length > 0) {
      for (const line of totalLines) {
           const matches = line.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g);
           for (const m of matches) {
                let valStr = m[0];
                const lastDot = valStr.lastIndexOf('.');
                const lastComma = valStr.lastIndexOf(',');
                if (lastComma > lastDot) valStr = valStr.replace(/\./g, '').replace(',', '.');
                else valStr = valStr.replace(/,/g, '');
                const val = parseFloat(valStr);
                if (!isNaN(val)) totalCandidates.push(val);
           }
      }
  }

  // Strategy: If explicit total candidates exist, take the max of them. 
  // Else, take the max of all found numbers (risky, could be a phone number, but usually prices have decimals).
  if (totalCandidates.length > 0) {
      totalAmount = Math.max(...totalCandidates);
  } else if (possibleAmounts.length > 0) {
      totalAmount = Math.max(...possibleAmounts);
  }

  // 3. Find NIF/RIF/CIF
  // V-12345678, J-123456789, etc.
  // RIF followed by J-..., V-..., etc.
  const rifMatch = cleaned.match(/(?:RIF|NIF|R\.I\.F\.?)[\s:.-]*([VJEPG]-?\d{5,9}-?\d?)/i);
  if (rifMatch) nif = rifMatch[1];


  return {
    rawText: text,
    extracted: {
      date,
      amount: totalAmount,
      nif,
      invoiceNumber: null // TODO: Hard to identify without context
    }
  };
}

export const scanInvoice = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  /* 
     Tesseract v5 Syntax:
     const worker = await createWorker('eng');
     const ret = await worker.recognize(image);
     await worker.terminate();
  */

  const filePath = req.file.path;

  try {
    console.log('📷 Starting OCR scan for:', filePath);
    
    // Tesseract process
    // Initialize with Spanish and English 
    const worker = await createWorker(['spa', 'eng']); 
    
    const { data: { text } } = await worker.recognize(filePath);
    console.log('📝 OCR Result (First 50 chars):', text.substring(0, 50).replace(/\n/g, ' '));
    
    await worker.terminate();

    // Parse logic
    const parsedData = parseInvoiceText(text);

    // Clean up file
    try {
        fs.unlinkSync(filePath); 
    } catch(e) { 
        console.warn('Failed to delete temp file:', filePath); 
    }

    res.json({
      ok: true,
      data: parsedData.extracted,
      debugText: parsedData.rawText
    });

  } catch (error: any) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'OCR processing failed', details: error.message });
  }
}
