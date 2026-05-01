import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'd:\\Documentos\\espacio_vc\\app_fink\\V011180626.xls'; // Ajustar ruta si es necesario

try {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  
  // Imprimir raw values de las celdas de fecha (Columna A asumo)
  // Rango A2:A10
  console.log("--- RAW CELL VALUES (A2-A10) ---");
  for (let r = 2; r <= 10; r++) {
    const cell = ws[`A${r}`];
    console.log(`Row ${r}:`, cell ? { t: cell.t, v: cell.v, w: cell.w } : 'Empty');
  }

  // Convertir a JSON con raw: true para obtener valores numéricos directos
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  console.log("\n--- SHEET_TO_JSON (raw: true) ---");
  // Imprimir filas 0 (header) y 1-5 (datos)
  console.log(data.slice(0, 6));

} catch (e) {
  console.error("Error reading file:", e);
}
