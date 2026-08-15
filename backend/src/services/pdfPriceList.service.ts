import PDFDocument from 'pdfkit';

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

export function generatePriceListPDFBuffer(options: PriceListPDFOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const { products, tasaBCV, tasaParalelo, tasaEUR, adjustmentPercentage, projectName } = options;

        const doc = new PDFDocument({ 
            size: 'A4', 
            margin: 45, 
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
        const W      = doc.page.width - 90; // Usable width: 505.28 pt
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
           .text('ALUDRA', LEFT + 20, 60, { continued: true })
           .fillColor('white').font('Helvetica')
           .text('GROUP', { continued: false });

        doc.fontSize(7).fillColor('#9ca3af')
           .text('SOLUCIONES INDUSTRIALES Y COMERCIALES', LEFT + 20, 86);

        const lucemY = 98;
        doc.fontSize(7).fillColor('#9ca3af')
           .text('Inversiones Lucem C.A.  RIF: J-40500250-6  |  Ciudad de La Victoria, Aragua, Venezuela', LEFT + 20, lucemY);
        doc.text('+58 412-271-1859  |  admin@grupoaludra.com  |  www.grupoaludra.com', LEFT + 20, lucemY + 10);

        // Encabezado derecho
        doc.fontSize(11).fillColor('white').font('Helvetica-Bold')
           .text('LISTA DE PRECIOS OFICIAL', 310, 58, { width: 220, align: 'right' });
        
        if (projectName) {
            doc.fontSize(8.5).fillColor(GREEN).font('Helvetica-Bold')
               .text(`PROYECTO: ${projectName.toUpperCase()}`, 310, 72, { width: 220, align: 'right' });
        }

        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
           .text(`Fecha de emisión: ${fmtDate(ahora)}`, 310, 85, { width: 220, align: 'right' });

        if (adjustmentPercentage !== 0) {
            const sign = adjustmentPercentage > 0 ? '+' : '';
            doc.fontSize(7.5).fillColor(GREEN).font('Helvetica-Bold')
               .text(`Ajuste Aplicado: ${sign}${adjustmentPercentage.toFixed(2)}%`, 310, 96, { width: 220, align: 'right' });
        } else {
            doc.fontSize(7.5).fillColor('#9ca3af').font('Helvetica')
               .text(`Precios Base (Sin Ajuste)`, 310, 96, { width: 220, align: 'right' });
        }

        // ── BARRA DE TASAS ───────────────────────────────────────
        const parStr = tasaParalelo ? `  |  Paralelo = Bs. ${tasaParalelo.toFixed(2)}/USD` : '';
        const eurStr = tasaEUR ? `  |  EUR = Bs. ${tasaEUR.toFixed(2)}/EUR` : '';
        doc.fontSize(7).fillColor(GRAY).font('Helvetica')
           .text(`Tasas de referencia vigentes:  BCV = Bs. ${tasaBCV.toFixed(2)}/USD${parStr}${eurStr}`, LEFT, 142, { align: 'center', width: W });

        // ── AGRUPACIÓN POR DIVISIÓN ───────────────────────────────
        const grouped: { [key: string]: ProductForPDF[] } = {};
        products.forEach(p => {
            const div = p.division || 'GENERAL / SIN DIVISION';
            if (!grouped[div]) grouped[div] = [];
            grouped[div].push(p);
        });

        const divisions = Object.keys(grouped).sort();

        // Decoración de páginas
        const drawPageDecoration = (pageNum: number) => {
            doc.save();
            const yFooter = doc.page.height - 40;
            doc.moveTo(LEFT, yFooter).lineTo(LEFT + W, yFooter).strokeColor(GREEN).lineWidth(0.5).stroke();
            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
               .text(`Grupo Aludra © ${ahora.getFullYear()} | Inversiones Lucem C.A. | Documento generado desde FINK`, LEFT, yFooter + 6, { width: W - 70, align: 'left' });
            doc.text(`Página ${pageNum}`, LEFT + W - 60, yFooter + 6, { width: 60, align: 'right' });
            doc.restore();
        };

        let pageCount = 1;
        doc.on('pageAdded', () => {
            pageCount++;
            drawPageDecoration(pageCount);
        });

        drawPageDecoration(1);

        // Anchos de columna (Suma: 70 + 285 + 60 + 90 = 505 pt)
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

        divisions.forEach((div) => {
            if (y > doc.page.height - 100) {
                doc.addPage();
                y = 50;
            }

            // Encabezado de la división
            doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold')
               .text(div.toUpperCase(), LEFT, y);
            y += 13;

            // Encabezado de la tabla
            doc.rect(LEFT, y, W, 15).fill(DARK);
            doc.fontSize(7).fillColor('white').font('Helvetica-Bold');
            doc.text('SKU', cols.sku + 3, y + 4, { width: colWidths.sku });
            doc.text('DESCRIPCIÓN DEL PRODUCTO', cols.nombre + 3, y + 4, { width: colWidths.nombre });
            doc.text('P. USD', cols.pUSD, y + 4, { width: colWidths.pUSD, align: 'right' });
            doc.text('P. Bs (BCV)', cols.pBs, y + 4, { width: colWidths.pBs, align: 'right' });
            y += 15;

            const prods = grouped[div];
            prods.forEach((prod, prodIdx) => {
                let extraParts: string[] = [];
                if (prod.empaqueCantidad && prod.empaqueCantidad > 1) {
                    extraParts.push(`Empaque: ${prod.empaqueCantidad} ${prod.unit || 'unidades'}`);
                } else if (prod.unit && prod.unit !== 'Unidades') {
                    extraParts.push(`Unidad: ${prod.unit}`);
                }
                if (prod.medidas) extraParts.push(`Medidas: ${prod.medidas}`);
                if (prod.medidasEmpaque) extraParts.push(`Dim. Empaque: ${prod.medidasEmpaque}`);
                if (prod.pedidoMinimo) extraParts.push(`Compra Mín: ${prod.pedidoMinimo}`);

                const hasExtra = extraParts.length > 0;
                const extraTextStr = extraParts.join("  |  ");
                const rowH = hasExtra ? 22 : 18;

                if (y > doc.page.height - 75 - rowH) {
                    doc.addPage();
                    y = 50;

                    // Volver a dibujar encabezado de la tabla en nueva página
                    doc.rect(LEFT, y, W, 15).fill(DARK);
                    doc.fontSize(7).fillColor('white').font('Helvetica-Bold');
                    doc.text('SKU', cols.sku + 3, y + 4, { width: colWidths.sku });
                    doc.text('DESCRIPCIÓN DEL PRODUCTO', cols.nombre + 3, y + 4, { width: colWidths.nombre });
                    doc.text('P. USD', cols.pUSD, y + 4, { width: colWidths.pUSD, align: 'right' });
                    doc.text('P. Bs (BCV)', cols.pBs, y + 4, { width: colWidths.pBs, align: 'right' });
                    y += 15;
                }

                // Zebra striping
                if (prodIdx % 2 === 0) doc.rect(LEFT, y, W, rowH).fill(LGRAY);
                else doc.rect(LEFT, y, W, rowH).fill('white');

                // Aplicar porcentaje de incremento / descuento
                const factor = 1 + (adjustmentPercentage / 100);
                const adjustedUsd = prod.unitPrice * factor;
                const adjustedBs = adjustedUsd * tasaBCV;

                const pBsFormatted = adjustedBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const textY = hasExtra ? y + 4 : y + 5;

                // SKU
                doc.fontSize(6.5).fillColor(GRAY).font('Helvetica');
                doc.text(prod.sku || 'N/A', cols.sku + 3, textY, { width: colWidths.sku });

                // Nombre y Detalles
                doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
                if (hasExtra) {
                    doc.text(prod.name, cols.nombre + 3, y + 3, { width: colWidths.nombre });
                    doc.fontSize(6).fillColor(GRAY).font('Helvetica-Oblique');
                    doc.text(extraTextStr, cols.nombre + 3, y + 13, { width: colWidths.nombre });
                    doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
                } else {
                    doc.text(prod.name, cols.nombre + 3, textY, { width: colWidths.nombre });
                }

                // Precios
                doc.text(`$${adjustedUsd.toFixed(2)}`, cols.pUSD, textY, { width: colWidths.pUSD, align: 'right' });
                doc.text(`Bs ${pBsFormatted}`, cols.pBs, textY, { width: colWidths.pBs, align: 'right' });

                y += rowH;
            });

            y += 12; // Espacio entre divisiones
        });

        // ── CUADRO DE CONDICIONES Y MARCO FINAL ───────────────────
        if (y > doc.page.height - 110) {
            doc.addPage();
            y = 50;
        }

        const qrX = LEFT + W - 80;
        const qrY = y;

        doc.rect(LEFT, y, W - 90, 68).fill('#fffbeb');
        doc.rect(LEFT, y, 3, 68).fill('#f59e0b');
        doc.fontSize(8).fillColor('#92400e').font('Helvetica-Bold')
           .text('Condiciones de Venta y Tarifas:', LEFT + 10, y + 6);
        doc.fontSize(6.5).font('Helvetica')
           .text('* Los precios en Bolívares se calculan con la tasa oficial del Banco Central de Venezuela (BCV).', LEFT + 10, y + 18, { width: W - 110 })
           .text('* Precios y disponibilidad de mercancía sujetos a cambios sin previo aviso.', LEFT + 10, y + 29, { width: W - 110 })
           .text('* Para pedidos y atención comercial personalizada: +58 412-271-1859.', LEFT + 10, y + 40, { width: W - 110 });

        // Caja Informativa QR a la derecha
        doc.rect(qrX - 5, qrY, 85, 68).fill(LGRAY);
        doc.rect(qrX - 5, qrY, 2, 68).fill(GREEN);

        doc.fontSize(6.5).fillColor(DARK).font('Helvetica-Bold')
           .text('ESCANEA EL QR', qrX, qrY + 8, { width: 75, align: 'center' });
        doc.fontSize(5.5).fillColor(GRAY).font('Helvetica')
           .text('Catálogo Online', qrX, qrY + 16, { width: 75, align: 'center' });
        doc.fontSize(6).fillColor(DARK).font('Helvetica-Bold')
           .text('catalogo.grupoaludra.com', qrX, qrY + 34, { width: 75, align: 'center' });

        doc.end();
    });
}
