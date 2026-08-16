import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface ProductForPDF {
    sku?: string;
    name: string;
    unitPrice: number;
    division?: string;
    unit?: string;
    empaqueCantidad?: number;
    medidas?: string;
    medidasEmpaque?: string;
    pedidoMinimo?: string;
}

export interface PriceListPDFOptions {
    products: ProductForPDF[];
    tasaBCV: number;
    tasaParalelo?: number;
    tasaEUR?: number;
    adjustmentPercentage: number; // Ej: +15 o -10
    projectName?: string;
}

export async function generatePriceListPDFBuffer(options: PriceListPDFOptions): Promise<Buffer> {
    const { products, tasaBCV, tasaParalelo, tasaEUR, adjustmentPercentage, projectName } = options;
    
    // Generar imagen real de QR Code para catalogo.grupoaludra.com
    const qrBuffer = await QRCode.toBuffer('https://catalogo.grupoaludra.com/', { 
        margin: 1, 
        width: 140,
        color: { dark: '#1f2937', light: '#ffffff' }
    });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            size: 'A4', 
            margin: 0, // Control 100% manual para evitar saltos automáticos no deseados / hojas en blanco
            bufferPages: true,
            info: { Title: 'Lista de Precios Aludra', Author: 'Grupo Aludra' } 
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const GREEN  = '#10b981';
        const DARK   = '#1f2937';
        const GRAY   = '#6b7280';
        const LGRAY  = '#f3f4f6';
        const W      = doc.page.width - 90; // Ancho utilizable exacto: 505.28 pt
        const LEFT   = 45;

        const ahora = new Date();
        const fmtDate = (d: Date) => d.toLocaleString('es-VE', { 
            timeZone: 'America/Caracas', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });

        // ── HEADER ──────────────────────────────────────────────
        doc.rect(LEFT, 45, W, 85).fill(DARK);

        // Logo / Branding Text
        doc.fontSize(22).fillColor(GREEN).font('Helvetica-Bold')
           .text('ALUDRA', LEFT + 20, 60, { continued: true, lineBreak: false })
           .fillColor('white').font('Helvetica')
           .text('GROUP', { continued: false, lineBreak: false });

        doc.fontSize(7).fillColor('#9ca3af')
           .text('SOLUCIONES INDUSTRIALES Y COMERCIALES', LEFT + 20, 86, { lineBreak: false });

        const lucemY = 98;
        doc.fontSize(7).fillColor('#9ca3af')
           .text('Inversiones Lucem C.A.  RIF: J-40500250-6  |  Ciudad de La Victoria, Aragua, Venezuela', LEFT + 20, lucemY, { lineBreak: false });
        doc.text('+58 412-271-1859  |  admin@grupoaludra.com  |  www.grupoaludra.com', LEFT + 20, lucemY + 10, { lineBreak: false });

        // Encabezado derecho
        doc.fontSize(11).fillColor('white').font('Helvetica-Bold')
           .text('LISTA DE PRECIOS OFICIAL', 310, 62, { width: 220, align: 'right', lineBreak: false });
        
        if (projectName) {
            doc.fontSize(8.5).fillColor(GREEN).font('Helvetica-Bold')
               .text(`PROYECTO: ${projectName.toUpperCase()}`, 310, 77, { width: 220, align: 'right', lineBreak: false });
        }

        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
           .text(`Fecha de emisión: ${fmtDate(ahora)}`, 310, 91, { width: 220, align: 'right', lineBreak: false });

        // ── BARRA DE TASAS ───────────────────────────────────────
        const parStr = tasaParalelo ? `  |  Paralelo = Bs. ${tasaParalelo.toFixed(2)}/USD` : '';
        const eurStr = tasaEUR ? `  |  EUR = Bs. ${tasaEUR.toFixed(2)}/EUR` : '';
        doc.fontSize(7).fillColor(GRAY).font('Helvetica')
           .text(`Tasas de referencia vigentes:  BCV = Bs. ${tasaBCV.toFixed(2)}/USD${parStr}${eurStr}`, LEFT, 142, { align: 'center', width: W, lineBreak: false });

        // ── AGRUPACIÓN POR DIVISIÓN ───────────────────────────────
        const grouped: { [key: string]: ProductForPDF[] } = {};
        products.forEach(p => {
            const div = p.division || 'GENERAL / SIN DIVISION';
            if (!grouped[div]) grouped[div] = [];
            grouped[div].push(p);
        });

        const divisions = Object.keys(grouped).sort();

        // Anchos de columna (Suma: 70 + 280 + 60 + 80 = 490 pt)
        const cols = {
            sku: LEFT,
            nombre: LEFT + 75,
            pUSD: LEFT + 360,
            pBs: LEFT + 425
        };
        const colWidths = {
            sku: 70,
            nombre: 280,
            pUSD: 60,
            pBs: 80
        };

        let y = 158;

        function drawTableHeader(currentY: number) {
            doc.rect(LEFT, currentY, W, 15).fill(DARK);
            doc.fontSize(7).fillColor('white').font('Helvetica-Bold');
            doc.text('SKU', cols.sku + 3, currentY + 4, { width: colWidths.sku, lineBreak: false });
            doc.text('DESCRIPCIÓN DEL PRODUCTO', cols.nombre + 3, currentY + 4, { width: colWidths.nombre, lineBreak: false });
            doc.text('P. USD', cols.pUSD, currentY + 4, { width: colWidths.pUSD, align: 'right', lineBreak: false });
            doc.text('P. Bs (BCV)', cols.pBs, currentY + 4, { width: colWidths.pBs, align: 'right', lineBreak: false });
            return currentY + 15;
        }

        divisions.forEach((div) => {
            const prods = grouped[div];
            if (!prods || prods.length === 0) return;

            if (y > doc.page.height - 95) {
                doc.addPage();
                y = 45;
            }

            // Encabezado de la división
            doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold')
               .text(div.toUpperCase(), LEFT, y, { lineBreak: false });
            y += 13;

            // Encabezado de la tabla
            y = drawTableHeader(y);

            prods.forEach((prod, prodIdx) => {
                let extraParts: string[] = [];
                if (prod.empaqueCantidad && prod.empaqueCantidad > 1) {
                    extraParts.push(`Empaque: ${prod.empaqueCantidad} ${prod.unit || 'unidades'}`);
                } else if (prod.unit && prod.unit.toLowerCase() !== 'unidades' && prod.unit.toLowerCase() !== 'unidad' && prod.unit.toLowerCase() !== 'und') {
                    extraParts.push(`Unidad: ${prod.unit}`);
                }
                if (prod.medidas) extraParts.push(`Medidas: ${prod.medidas}`);
                if (prod.medidasEmpaque) extraParts.push(`Dim. Empaque: ${prod.medidasEmpaque}`);
                if (prod.pedidoMinimo) extraParts.push(`Compra Mín: ${prod.pedidoMinimo}`);

                const hasExtra = extraParts.length > 0;
                const extraTextStr = extraParts.join("  |  ");

                // Medición dinámica de altura para evitar solapamientos
                doc.fontSize(7.5).font('Helvetica');
                const nameHeight = doc.heightOfString(prod.name, { width: colWidths.nombre });
                doc.fontSize(6.5).font('Helvetica');
                const skuHeight = doc.heightOfString(prod.sku || 'N/A', { width: colWidths.sku });
                const extraHeight = hasExtra ? 9 : 0;

                const contentH = Math.max(nameHeight + extraHeight, skuHeight);
                const rowH = Math.max(contentH + 6, 18);

                if (y > doc.page.height - 55 - rowH) {
                    doc.addPage();
                    y = 45;
                    y = drawTableHeader(y);
                }

                // Zebra striping
                if (prodIdx % 2 === 0) doc.rect(LEFT, y, W, rowH).fill(LGRAY);
                else doc.rect(LEFT, y, W, rowH).fill('white');

                // Aplicar porcentaje de incremento / descuento
                const factor = 1 + (adjustmentPercentage / 100);
                const adjustedUsd = prod.unitPrice * factor;
                const adjustedBs = adjustedUsd * tasaBCV;

                const pBsFormatted = adjustedBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const middleY = y + (rowH / 2) - 4;

                // SKU
                doc.fontSize(6.5).fillColor(GRAY).font('Helvetica');
                doc.text(prod.sku || 'N/A', cols.sku + 3, y + 4, { width: colWidths.sku });

                // Nombre y Detalles con posicionamiento dinámico (nunca se solapa)
                doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
                doc.text(prod.name, cols.nombre + 3, y + 3, { width: colWidths.nombre });

                if (hasExtra) {
                    const extraY = y + 3 + nameHeight + 1;
                    doc.fontSize(6).fillColor(GRAY).font('Helvetica-Oblique');
                    doc.text(extraTextStr, cols.nombre + 3, extraY, { width: colWidths.nombre, lineBreak: false });
                }

                // Precios centrados verticalmente
                doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
                doc.text(`$${adjustedUsd.toFixed(2)}`, cols.pUSD, middleY, { width: colWidths.pUSD, align: 'right', lineBreak: false });
                doc.text(`Bs ${pBsFormatted}`, cols.pBs, middleY, { width: colWidths.pBs, align: 'right', lineBreak: false });

                y += rowH;
            });

            y += 12; // Espacio entre divisiones
        });

        // ── BARRA RESUMEN DE TOTAL DE PRODUCTOS ───────────────────
        if (y > doc.page.height - 110) {
            doc.addPage();
            y = 45;
        }

        doc.rect(LEFT, y, W, 18).fill('#f8fafc');
        doc.rect(LEFT, y, W, 18).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold')
           .text(`TOTAL DE PRODUCTOS / ÍTEMS LISTADOS:`, LEFT + 12, y + 5, { continued: true, lineBreak: false })
           .fillColor(GREEN).font('Helvetica-Bold')
           .text(`  ${products.length} PRODUCTOS`, { continued: false, lineBreak: false });
        y += 24;

        // ── CUADRO DE CONDICIONES Y MARCO FINAL ───────────────────
        if (y > doc.page.height - 95) {
            doc.addPage();
            y = 45;
        }

        const qrX = LEFT + W - 80;
        const qrY = y;

        doc.rect(LEFT, y, W - 90, 68).fill('#fffbeb');
        doc.rect(LEFT, y, 3, 68).fill('#f59e0b');
        doc.fontSize(8).fillColor('#92400e').font('Helvetica-Bold')
           .text('Condiciones de Venta y Tarifas:', LEFT + 10, y + 6, { lineBreak: false });
        doc.fontSize(6.5).font('Helvetica')
           .text('* Los precios en Bolívares se calculan con la tasa oficial del Banco Central de Venezuela (BCV).', LEFT + 10, y + 18, { width: W - 110, lineBreak: false })
           .text('* Precios y disponibilidad de mercancía sujetos a cambios sin previo aviso.', LEFT + 10, y + 29, { width: W - 110, lineBreak: false })
           .text('* Para pedidos y atención comercial personalizada: +58 412-271-1859.', LEFT + 10, y + 40, { width: W - 110, lineBreak: false });

        // Caja Informativa con Imagen Real QR
        doc.rect(qrX - 5, qrY, 85, 68).fill(LGRAY);
        doc.rect(qrX - 5, qrY, 2, 68).fill(GREEN);

        doc.fontSize(6).fillColor(DARK).font('Helvetica-Bold')
           .text('CATÁLOGO ONLINE', qrX - 5, qrY + 5, { width: 85, align: 'center', lineBreak: false });

        // Insertar imagen PNG del QR Code
        doc.image(qrBuffer, qrX + 18, qrY + 14, { width: 38, height: 38 });

        doc.fontSize(5).fillColor(GRAY).font('Helvetica')
           .text('catalogo.grupoaludra.com', qrX - 5, qrY + 55, { width: 85, align: 'center', lineBreak: false });

        // ── FOOTERS (DIBUJO DE PÁGINAS Y FOOTER SEGURO) ───────────
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const yFooter = doc.page.height - 30;
            doc.save();
            doc.moveTo(LEFT, yFooter).lineTo(LEFT + W, yFooter).strokeColor(GREEN).lineWidth(0.5).stroke();
            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
               .text(`Grupo Aludra © ${ahora.getFullYear()} | Inversiones Lucem C.A. | Documento generado desde FINK`, LEFT, yFooter + 4, { width: W - 70, align: 'left', lineBreak: false });
            doc.text(`Página ${i + 1} de ${range.count}`, LEFT + W - 60, yFooter + 4, { width: 60, align: 'right', lineBreak: false });
            doc.restore();
        }

        doc.end();
    });
}
