import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface QuotationItem {
    sku?: string;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice: number;   // Precio de contado en Divisas
    priceList?: number;  // Precio base en Bolívares a tasa BCV
    discountPercent?: number;
    medidas?: string;
    empaqueCantidad?: number;
    notes?: string;
}

export interface QuotationPDFOptions {
    quotationNumber?: string;
    clientName: string;
    clientTaxId?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientAddress?: string;
    projectName?: string;
    tasaBCV: number;
    tasaParalelo?: number;
    tasaEUR?: number;
    items: QuotationItem[];
    applyTax?: boolean;
    taxRate?: number;
    notes?: string;
}

function generarNumeroCotizacion(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `COT-${year}${month}${day}-${rand}`;
}

export async function generateQuotationPDFBuffer(options: QuotationPDFOptions): Promise<{ buffer: Buffer; quotationNumber: string }> {
    const {
        quotationNumber = generarNumeroCotizacion(),
        clientName,
        clientTaxId,
        clientPhone,
        clientEmail,
        clientAddress,
        projectName = 'Inversiones Lucem C.A.',
        tasaBCV,
        tasaParalelo,
        tasaEUR,
        items,
        applyTax = false,
        taxRate = 16,
        notes
    } = options;

    // Generar imagen real de QR Code para contacto directo por WhatsApp
    const whatsappUrl = `https://wa.me/584122711859?text=${encodeURIComponent(`Hola, quisiera confirmar la cotización ${quotationNumber} a nombre de ${clientName}`)}`;
    const qrBuffer = await QRCode.toBuffer(whatsappUrl, { 
        margin: 1, 
        width: 140,
        color: { dark: '#1f2937', light: '#ffffff' }
    });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            size: 'A4', 
            margin: 0, // Control estricto para evitar páginas vacías
            bufferPages: true,
            info: { Title: quotationNumber, Author: 'Grupo Aludra - FINK' } 
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), quotationNumber }));
        doc.on('error', (err) => reject(err));

        const GREEN  = '#10b981';
        const DARK   = '#1f2937';
        const GRAY   = '#6b7280';
        const LGRAY  = '#f3f4f6';
        const W      = doc.page.width - 90; // 505.28 pt
        const LEFT   = 45;

        const ahora = new Date();
        const vigencia = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
        const fmtDate = (d: Date) => d.toLocaleString('es-VE', { 
            timeZone: 'America/Caracas', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });

        // ── 1. ENCABEZADO CORPORATIVO ─────────────────────────────
        doc.rect(LEFT, 40, W, 85).fill(DARK);

        // Logo / Branding Text
        doc.fontSize(22).fillColor(GREEN).font('Helvetica-Bold')
           .text('ALUDRA', LEFT + 20, 52, { continued: true, lineBreak: false })
           .fillColor('white').font('Helvetica')
           .text('GROUP', { continued: false, lineBreak: false });

        doc.fontSize(7).fillColor('#9ca3af')
           .text('SOLUCIONES INDUSTRIALES Y COMERCIALES', LEFT + 20, 78, { lineBreak: false });

        const lucemY = 90;
        doc.fontSize(7).fillColor('#9ca3af')
           .text('Inversiones Lucem C.A.  RIF: J-40500250-6  |  Ciudad de La Victoria, Aragua, Venezuela', LEFT + 20, lucemY, { lineBreak: false });
        doc.text('+58 412-271-1859  |  admin@grupoaludra.com  |  www.grupoaludra.com', LEFT + 20, lucemY + 10, { lineBreak: false });

        // Bloque derecho de cotización
        doc.fontSize(10).fillColor('white').font('Helvetica-Bold')
           .text('COTIZACIÓN FORMAL', 330, 52, { width: 200, align: 'right', lineBreak: false });
        doc.fontSize(12).fillColor(GREEN).font('Helvetica-Bold')
           .text(quotationNumber, 330, 66, { width: 200, align: 'right', lineBreak: false });
        doc.fontSize(7).fillColor('#9ca3af').font('Helvetica')
           .text(`Emitida: ${fmtDate(ahora)}`, 330, 83, { width: 200, align: 'right', lineBreak: false })
           .text(`Válida hasta: ${fmtDate(vigencia)} (48 horas)`, 330, 95, { width: 200, align: 'right', lineBreak: false });

        // ── 2. BLOQUE DE DATOS DEL CLIENTE ───────────────────────
        let y = 135;
        doc.rect(LEFT, y, W, 42).fill(LGRAY);
        doc.rect(LEFT, y, 4, 42).fill(GREEN);
        
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica-Bold')
           .text('COTIZACIÓN PREPARADA PARA:', LEFT + 12, y + 6, { lineBreak: false });
        doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
           .text(clientName.toUpperCase(), LEFT + 12, y + 15, { width: 330, lineBreak: false });

        const clientDetails = [
            clientTaxId ? `RIF/Cédula: ${clientTaxId}` : '',
            clientPhone ? `Tel: ${clientPhone}` : '',
            clientEmail ? `Email: ${clientEmail}` : ''
        ].filter(Boolean).join('   |   ');

        if (clientDetails) {
            doc.fontSize(7).fillColor(GRAY).font('Helvetica')
               .text(clientDetails, LEFT + 12, y + 29, { width: 450, lineBreak: false });
        }

        // ── 3. BARRA DE TASAS REFERENCIALES ───────────────────────
        y += 48;
        const parStr = tasaParalelo ? `  |  Paralelo = Bs. ${tasaParalelo.toFixed(2)}/USD` : '';
        const eurStr = tasaEUR ? `  |  EUR = Bs. ${tasaEUR.toFixed(2)}/EUR` : '';
        doc.fontSize(7).fillColor(GRAY).font('Helvetica')
           .text(`Tasas referenciales al emitir:  BCV = Bs. ${tasaBCV.toFixed(2)}/USD${parStr}${eurStr}`, LEFT, y, { align: 'center', width: W, lineBreak: false });

        y += 14;

        // ── 4. TABLA DE PRODUCTOS COTIZADOS ───────────────────────
        // Columnas: SKU (55), Descripción (195), Cant (35), P.U. Divisas (55), P.U. BCV (55), Total Divisas (55), Total Bs (55) -> 505 pt
        const cols = {
            sku: LEFT,
            nombre: LEFT + 58,
            cant: LEFT + 248,
            puDivisas: LEFT + 283,
            puBcv: LEFT + 338,
            totDivisas: LEFT + 393,
            totBs: LEFT + 448
        };
        const colWidths = {
            sku: 55,
            nombre: 186,
            cant: 32,
            puDivisas: 52,
            puBcv: 52,
            totDivisas: 52,
            totBs: 57
        };

        function drawTableHeader(currentY: number) {
            doc.rect(LEFT, currentY, W, 16).fill(DARK);
            doc.fontSize(6.5).fillColor('white').font('Helvetica-Bold');
            doc.text('SKU', cols.sku + 3, currentY + 5, { width: colWidths.sku, lineBreak: false });
            doc.text('DESCRIPCIÓN DEL ÍTEM', cols.nombre + 3, currentY + 5, { width: colWidths.nombre, lineBreak: false });
            doc.text('CANT', cols.cant, currentY + 5, { width: colWidths.cant, align: 'center', lineBreak: false });
            doc.text('P.U. ($)', cols.puDivisas, currentY + 5, { width: colWidths.puDivisas, align: 'right', lineBreak: false });
            doc.text('P.U. BCV ($)', cols.puBcv, currentY + 5, { width: colWidths.puBcv, align: 'right', lineBreak: false });
            doc.text('TOTAL ($)', cols.totDivisas, currentY + 5, { width: colWidths.totDivisas, align: 'right', lineBreak: false });
            doc.text('TOTAL Bs', cols.totBs, currentY + 5, { width: colWidths.totBs, align: 'right', lineBreak: false });
            return currentY + 16;
        }

        y = drawTableHeader(y);

        let subtotalDivisas = 0;
        let subtotalBcvUsd = 0;

        items.forEach((item, itemIdx) => {
            const qty = item.quantity || 1;
            const puDivisas = item.unitPrice || 0;
            const puBcvUsd = item.priceList && item.priceList > 0 ? item.priceList : puDivisas;

            const lineTotDivisas = puDivisas * qty;
            const lineTotBcvUsd = puBcvUsd * qty;
            const lineTotBs = lineTotBcvUsd * tasaBCV;

            subtotalDivisas += lineTotDivisas;
            subtotalBcvUsd += lineTotBcvUsd;

            let extraParts: string[] = [];
            if (item.unit && item.unit.toLowerCase() !== 'unidades' && item.unit.toLowerCase() !== 'unidad' && item.unit.toLowerCase() !== 'und') {
                extraParts.push(`Unidad: ${item.unit}`);
            }
            if (item.empaqueCantidad && item.empaqueCantidad > 1) {
                extraParts.push(`Empaque: ${item.empaqueCantidad}`);
            }
            if (item.medidas) extraParts.push(`Medidas: ${item.medidas}`);
            if (item.notes) extraParts.push(item.notes);

            const hasExtra = extraParts.length > 0;
            const extraTextStr = extraParts.join('  |  ');

            // Medición de altura dinámica
            doc.fontSize(7.5).font('Helvetica');
            const nameHeight = doc.heightOfString(item.name, { width: colWidths.nombre });
            doc.fontSize(6.5).font('Helvetica');
            const skuHeight = doc.heightOfString(item.sku || 'N/A', { width: colWidths.sku });
            const extraHeight = hasExtra ? 9 : 0;

            const contentH = Math.max(nameHeight + extraHeight, skuHeight);
            const rowH = Math.max(contentH + 6, 18);

            if (y > doc.page.height - 130 - rowH) {
                doc.addPage();
                y = 45;
                y = drawTableHeader(y);
            }

            if (itemIdx % 2 === 0) doc.rect(LEFT, y, W, rowH).fill(LGRAY);
            else doc.rect(LEFT, y, W, rowH).fill('white');

            const middleY = y + (rowH / 2) - 4;

            // SKU
            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica');
            doc.text(item.sku || 'N/A', cols.sku + 3, y + 4, { width: colWidths.sku });

            // Nombre y detalles
            doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
            doc.text(item.name, cols.nombre + 3, y + 3, { width: colWidths.nombre });

            if (hasExtra) {
                const extraY = y + 3 + nameHeight + 1;
                doc.fontSize(6).fillColor(GRAY).font('Helvetica-Oblique');
                doc.text(extraTextStr, cols.nombre + 3, extraY, { width: colWidths.nombre, lineBreak: false });
            }

            // Cantidad y Precios
            doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
            doc.text(qty.toString(), cols.cant, middleY, { width: colWidths.cant, align: 'center', lineBreak: false });
            doc.text(`$${puDivisas.toFixed(2)}`, cols.puDivisas, middleY, { width: colWidths.puDivisas, align: 'right', lineBreak: false });
            doc.text(`$${puBcvUsd.toFixed(2)}`, cols.puBcv, middleY, { width: colWidths.puBcv, align: 'right', lineBreak: false });
            
            doc.font('Helvetica-Bold');
            doc.text(`$${lineTotDivisas.toFixed(2)}`, cols.totDivisas, middleY, { width: colWidths.totDivisas, align: 'right', lineBreak: false });
            
            const lineBsFmt = lineTotBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            doc.text(`Bs ${lineBsFmt}`, cols.totBs, middleY, { width: colWidths.totBs, align: 'right', lineBreak: false });

            y += rowH;
        });

        y += 8;

        // ── 5. CUADRO DE TOTALES Y CONDICIONES ────────────────────
        const totalBs = subtotalBcvUsd * tasaBCV;
        const totalBsFmt = totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (y > doc.page.height - 180) {
            doc.addPage();
            y = 45;
        }

        // Caja de Totales (Derecha)
        const totW = 220;
        const totX = LEFT + W - totW;
        const totY = y;

        doc.rect(totX, totY, totW, 58).fill('#f8fafc');
        doc.rect(totX, totY, totW, 58).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

        doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
           .text('Total a Pagar en Moneda Extranjera:', totX + 10, totY + 8);
        doc.fontSize(11).fillColor(GREEN).font('Helvetica-Bold')
           .text(`$${subtotalDivisas.toFixed(2)} USD`, totX + 10, totY + 18);

        doc.moveTo(totX + 10, totY + 34).lineTo(totX + totW - 10, totY + 34).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
           .text('Total a Pagar en Bolívares (BCV):', totX + 10, totY + 38);
        doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
           .text(`Bs. ${totalBsFmt}`, totX + 10, totY + 47);

        // Caja de Cuentas Bancarias (Izquierda)
        const bankW = W - totW - 10;
        doc.rect(LEFT, totY, bankW, 58).fill('#f8fafc');
        doc.rect(LEFT, totY, bankW, 58).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        
        doc.fontSize(7.5).fillColor(DARK).font('Helvetica-Bold')
           .text('💳 Cuentas Bancarias / Métodos de Pago:', LEFT + 10, totY + 6, { lineBreak: false });

        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text('• Bolívares: Banesco Pago Móvil / Transferencia (J-40500250-6 | 0134 | 0412-271-1859)', LEFT + 10, totY + 18, { width: bankW - 15, lineBreak: false })
           .text('• Divisas: Zelle (admin@grupoaludra.com) | Banesco Panamá | Binance USDT', LEFT + 10, totY + 28, { width: bankW - 15, lineBreak: false })
           .text('• Efectivo: Dólares en billetes en buen estado.', LEFT + 10, totY + 38, { width: bankW - 15, lineBreak: false });

        y = totY + 66;

        // ── 6. CONDICIONES Y QR CODE ──────────────────────────────
        if (y > doc.page.height - 95) {
            doc.addPage();
            y = 45;
        }

        const qrX = LEFT + W - 80;
        const qrY = y;

        doc.rect(LEFT, y, W - 90, 68).fill('#fffbeb');
        doc.rect(LEFT, y, 3, 68).fill('#f59e0b');
        doc.fontSize(8).fillColor('#92400e').font('Helvetica-Bold')
           .text('Términos y Condiciones de la Cotización:', LEFT + 10, y + 6, { lineBreak: false });
        doc.fontSize(6.5).font('Helvetica')
           .text('* Precios en Bolívares calculados con la tasa oficial BCV vigente a la fecha de pago.', LEFT + 10, y + 18, { width: W - 110, lineBreak: false })
           .text('* Cotización válida por 48 horas continuas sujeta a disponibilidad de inventario.', LEFT + 10, y + 29, { width: W - 110, lineBreak: false })
           .text('* Para confirmar este pedido, responda a este documento o escanee el código QR.', LEFT + 10, y + 40, { width: W - 110, lineBreak: false });

        // Caja de WhatsApp QR
        doc.rect(qrX - 5, qrY, 85, 68).fill(LGRAY);
        doc.rect(qrX - 5, qrY, 2, 68).fill(GREEN);

        doc.fontSize(6).fillColor(DARK).font('Helvetica-Bold')
           .text('CONFIRMAR PEDIDO', qrX - 5, qrY + 5, { width: 85, align: 'center', lineBreak: false });

        doc.image(qrBuffer, qrX + 18, qrY + 14, { width: 38, height: 38 });

        doc.fontSize(5).fillColor(GRAY).font('Helvetica')
           .text('+58 412-271-1859', qrX - 5, qrY + 55, { width: 85, align: 'center', lineBreak: false });

        // ── 7. FOOTERS DE PÁGINA ──────────────────────────────────
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const yFooter = doc.page.height - 30;
            doc.save();
            doc.moveTo(LEFT, yFooter).lineTo(LEFT + W, yFooter).strokeColor(GREEN).lineWidth(0.5).stroke();
            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
               .text(`Grupo Aludra © ${ahora.getFullYear()} | Inversiones Lucem C.A. | Cotización generada desde FINK`, LEFT, yFooter + 4, { width: W - 70, align: 'left', lineBreak: false });
            doc.text(`Página ${i + 1} de ${range.count}`, LEFT + W - 60, yFooter + 4, { width: 60, align: 'right', lineBreak: false });
            doc.restore();
        }

        doc.end();
    });
}
