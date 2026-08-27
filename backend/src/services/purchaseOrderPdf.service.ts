import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface PurchaseOrderItem {
    sku?: string;
    name: string;
    quantity: number;
    unit?: string;
    costPrice: number;   // Costo unitario acordado con el proveedor
    empaqueCantidad?: number;
    medidas?: string;
    notes?: string;
}

export interface PurchaseOrderPDFOptions {
    orderNumber?: string;
    supplierName: string;
    supplierTaxId?: string;
    supplierPhone?: string;
    supplierEmail?: string;
    supplierAddress?: string;
    companyName?: string;
    companyTaxId?: string;
    companyAddress?: string;
    companyPhone?: string;
    deliveryAddress?: string;
    expectedDate?: string;
    paymentTerms?: string;
    tasaBCV: number;
    items: PurchaseOrderItem[];
    notes?: string;
}

function generarNumeroOrdenCompra(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `OC-${year}${month}${day}-${rand}`;
}

export async function generatePurchaseOrderPDFBuffer(options: PurchaseOrderPDFOptions): Promise<{ buffer: Buffer; orderNumber: string }> {
    const {
        orderNumber = generarNumeroOrdenCompra(),
        supplierName,
        supplierTaxId,
        supplierPhone,
        supplierEmail,
        supplierAddress,
        companyName = 'Inversiones Lucem C.A. / Aludra Group',
        companyTaxId = 'J-40500250-6',
        companyAddress = 'Ciudad de La Victoria, Estado Aragua, Venezuela',
        companyPhone = '+58 412-271-1859',
        deliveryAddress = 'Almacén Principal La Victoria, Aragua',
        expectedDate = 'Inmediata / 24-48 horas',
        paymentTerms = 'Contado / Según acuerdo comercial',
        tasaBCV,
        items,
        notes
    } = options;

    const qrUrl = `https://wa.me/584122711859?text=${encodeURIComponent(`Orden de Compra ${orderNumber} para ${supplierName}`)}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, { 
        margin: 1, 
        width: 140,
        color: { dark: '#1e293b', light: '#ffffff' }
    });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            size: 'A4', 
            margin: 0, 
            bufferPages: true,
            info: { Title: orderNumber, Author: companyName } 
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: any) => buffers.push(chunk));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), orderNumber }));
        doc.on('error', (err: any) => reject(err));

        const BLUE   = '#2563eb';
        const DARK   = '#0f172a';
        const GRAY   = '#64748b';
        const LGRAY  = '#f8fafc';
        const W      = doc.page.width - 90; // 505.28 pt
        const LEFT   = 45;

        const ahora = new Date();
        const fmtDate = (d: Date) => d.toLocaleString('es-VE', { 
            timeZone: 'America/Caracas', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });

        // ── 1. ENCABEZADO DE ORDEN DE COMPRA ──────────────────────
        doc.rect(LEFT, 40, W, 85).fill(DARK);

        doc.fontSize(20).fillColor('#38bdf8').font('Helvetica-Bold')
           .text('ORDEN DE COMPRA', LEFT + 20, 52, { lineBreak: false });

        doc.fontSize(8).fillColor('white').font('Helvetica-Bold')
           .text(companyName.toUpperCase(), LEFT + 20, 76, { lineBreak: false });

        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
           .text(`RIF: ${companyTaxId}  |  ${companyAddress}`, LEFT + 20, 88, { lineBreak: false })
           .text(`Tel: ${companyPhone}  |  admin@grupoaludra.com`, LEFT + 20, 98, { lineBreak: false });

        // Bloque derecho de datos del documento
        doc.fontSize(13).fillColor('#38bdf8').font('Helvetica-Bold')
           .text(orderNumber, 330, 52, { width: 200, align: 'right', lineBreak: false });
        doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
           .text(`Fecha de Emisión: ${fmtDate(ahora)}`, 330, 72, { width: 200, align: 'right', lineBreak: false })
           .text(`Entrega Estimada: ${expectedDate}`, 330, 84, { width: 200, align: 'right', lineBreak: false })
           .text(`Condición de Pago: ${paymentTerms}`, 330, 96, { width: 200, align: 'right', lineBreak: false });

        // ── 2. PROVEEDOR Y DESPACHO (2 COLUMNAS) ──────────────────
        let y = 135;
        const boxW = (W - 10) / 2;

        // Caja Proveedor
        doc.rect(LEFT, y, boxW, 56).fill(LGRAY);
        doc.rect(LEFT, y, 4, 56).fill(BLUE);
        doc.fontSize(7).fillColor(BLUE).font('Helvetica-Bold')
           .text('PROVEEDOR ADJUDICADO:', LEFT + 10, y + 6, { lineBreak: false });
        doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
           .text(supplierName.toUpperCase(), LEFT + 10, y + 17, { width: boxW - 15, lineBreak: false });
        
        const suppDet = [
            supplierTaxId ? `RIF: ${supplierTaxId}` : '',
            supplierPhone ? `Tel: ${supplierPhone}` : '',
            supplierEmail ? `Email: ${supplierEmail}` : ''
        ].filter(Boolean).join('  |  ');
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text(suppDet || 'Proveedor registrado', LEFT + 10, y + 32, { width: boxW - 15, lineBreak: false });
        if (supplierAddress) {
            doc.text(supplierAddress, LEFT + 10, y + 42, { width: boxW - 15, lineBreak: false });
        }

        // Caja Dirección de Entrega y Referencia
        const col2X = LEFT + boxW + 10;
        doc.rect(col2X, y, boxW, 56).fill(LGRAY);
        doc.rect(col2X, y, 4, 56).fill('#0ea5e9');
        doc.fontSize(7).fillColor('#0369a1').font('Helvetica-Bold')
           .text('LUGAR DE RECEPCIÓN / ENTREGA:', col2X + 10, y + 6, { lineBreak: false });
        doc.fontSize(8.5).fillColor(DARK).font('Helvetica-Bold')
           .text(deliveryAddress, col2X + 10, y + 17, { width: boxW - 15, lineBreak: false });
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text(`Tasa Oficial BCV de Referencia: Bs. ${tasaBCV.toFixed(2)} / USD`, col2X + 10, y + 34, { width: boxW - 15, lineBreak: false })
           .text('Presentar esta orden física o digital al entregar la mercancía', col2X + 10, y + 44, { width: boxW - 15, lineBreak: false });

        y += 66;

        // ── 3. TABLA DE PRODUCTOS A SOLICITAR ─────────────────────
        const cols = {
            sku: LEFT,
            nombre: LEFT + 65,
            cant: LEFT + 270,
            costoUnit: LEFT + 320,
            costoTotUsd: LEFT + 395,
            costoTotBs: LEFT + 450
        };
        const colWidths = {
            sku: 60,
            nombre: 200,
            cant: 45,
            costoUnit: 70,
            costoTotUsd: 50,
            costoTotBs: 55
        };

        function drawTableHeader(currentY: number) {
            doc.rect(LEFT, currentY, W, 16).fill(DARK);
            doc.fontSize(6.5).fillColor('white').font('Helvetica-Bold');
            doc.text('SKU / CÓDIGO', cols.sku + 3, currentY + 5, { width: colWidths.sku, lineBreak: false });
            doc.text('DESCRIPCIÓN DEL PRODUCTO', cols.nombre + 3, currentY + 5, { width: colWidths.nombre, lineBreak: false });
            doc.text('CANTIDAD', cols.cant, currentY + 5, { width: colWidths.cant, align: 'center', lineBreak: false });
            doc.text('COSTO P.U. ($)', cols.costoUnit, currentY + 5, { width: colWidths.costoUnit, align: 'right', lineBreak: false });
            doc.text('TOTAL ($)', cols.costoTotUsd, currentY + 5, { width: colWidths.costoTotUsd, align: 'right', lineBreak: false });
            doc.text('TOTAL Bs (BCV)', cols.costoTotBs, currentY + 5, { width: colWidths.costoTotBs, align: 'right', lineBreak: false });
            return currentY + 16;
        }

        y = drawTableHeader(y);

        let totalCostoUsd = 0;
        let totalItemsCount = 0;

        items.forEach((item, itemIdx) => {
            const qty = item.quantity || 1;
            const unitCost = item.costPrice || 0;
            const lineTotCost = unitCost * qty;
            const lineTotBs = lineTotCost * tasaBCV;

            totalCostoUsd += lineTotCost;
            totalItemsCount += qty;

            let extraParts: string[] = [];
            if (item.unit && item.unit.toLowerCase() !== 'unidades' && item.unit.toLowerCase() !== 'unidad' && item.unit.toLowerCase() !== 'und') {
                extraParts.push(`Unidad: ${item.unit}`);
            }
            if (item.empaqueCantidad && item.empaqueCantidad > 1) {
                extraParts.push(`Empaque: ${item.empaqueCantidad} und`);
            }
            if (item.medidas) extraParts.push(`Medidas: ${item.medidas}`);
            if (item.notes) extraParts.push(item.notes);

            const hasExtra = extraParts.length > 0;
            const extraTextStr = extraParts.join('  |  ');

            doc.fontSize(7.5).font('Helvetica');
            const nameHeight = doc.heightOfString(item.name, { width: colWidths.nombre });
            doc.fontSize(6.5).font('Helvetica');
            const skuHeight = doc.heightOfString(item.sku || 'N/A', { width: colWidths.sku });
            const extraHeight = hasExtra ? 9 : 0;

            const contentH = Math.max(nameHeight + extraHeight, skuHeight);
            const rowH = Math.max(contentH + 6, 18);

            if (y > doc.page.height - 120 - rowH) {
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

            // Nombre
            doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
            doc.text(item.name, cols.nombre + 3, y + 3, { width: colWidths.nombre });

            if (hasExtra) {
                const extraY = y + 3 + nameHeight + 1;
                doc.fontSize(6).fillColor(GRAY).font('Helvetica-Oblique');
                doc.text(extraTextStr, cols.nombre + 3, extraY, { width: colWidths.nombre, lineBreak: false });
            }

            // Cantidad y Costos
            doc.fontSize(7.5).fillColor(DARK).font('Helvetica');
            doc.text(qty.toString(), cols.cant, middleY, { width: colWidths.cant, align: 'center', lineBreak: false });
            doc.text(`$${unitCost.toFixed(2)}`, cols.costoUnit, middleY, { width: colWidths.costoUnit, align: 'right', lineBreak: false });
            
            doc.font('Helvetica-Bold');
            doc.text(`$${lineTotCost.toFixed(2)}`, cols.costoTotUsd, middleY, { width: colWidths.costoTotUsd, align: 'right', lineBreak: false });

            const lineBsFmt = lineTotBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            doc.text(`Bs ${lineBsFmt}`, cols.costoTotBs, middleY, { width: colWidths.costoTotBs, align: 'right', lineBreak: false });

            y += rowH;
        });

        y += 8;

        // ── 4. CUADRO DE TOTALES Y APROBACIÓN ───────────────────────
        const totalBs = totalCostoUsd * tasaBCV;
        const totalBsFmt = totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (y > doc.page.height - 140) {
            doc.addPage();
            y = 45;
        }

        // Totales a la derecha
        const totW = 210;
        const totX = LEFT + W - totW;
        const totY = y;

        doc.rect(totX, totY, totW, 52).fill('#f1f5f9');
        doc.rect(totX, totY, totW, 52).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

        doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
           .text('Total Orden de Compra (USD):', totX + 10, totY + 8);
        doc.fontSize(12).fillColor(BLUE).font('Helvetica-Bold')
           .text(`$${totalCostoUsd.toFixed(2)} USD`, totX + 10, totY + 18);

        doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
           .text('Equivalente a Tasa Oficial BCV:', totX + 10, totY + 34);
        doc.fontSize(9.5).fillColor(DARK).font('Helvetica-Bold')
           .text(`Bs. ${totalBsFmt}`, totX + 10, totY + 42);

        // Notas y Firmas a la izquierda
        const noteW = W - totW - 10;
        doc.rect(LEFT, totY, noteW, 52).fill('#f8fafc');
        doc.rect(LEFT, totY, noteW, 52).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

        doc.fontSize(7.5).fillColor(DARK).font('Helvetica-Bold')
           .text('Observaciones e Instrucciones de Despacho:', LEFT + 8, totY + 6, { lineBreak: false });
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text(notes || 'Favor confirmar recepción de la orden y fecha estimada de despacho.', LEFT + 8, totY + 18, { width: noteW - 15, lineBreak: false })
           .text(`Total Unidades Solicitadas: ${totalItemsCount} unidades en ${items.length} renglones.`, LEFT + 8, totY + 36, { lineBreak: false });

        y = totY + 62;

        // ── 5. FIRMAS DE APROBACIÓN ────────────────────────────────
        const signW = (W - 20) / 2;
        doc.rect(LEFT, y, signW, 45).fill('white').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text('EMITIDO Y APROBADO POR (LUCEM / ALUDRA):', LEFT + 10, y + 6);
        doc.moveTo(LEFT + 10, y + 32).lineTo(LEFT + signW - 10, y + 32).strokeColor('#94a3b8').lineWidth(0.5).stroke();
        doc.text('Firma Autorizada y Sello', LEFT + 10, y + 35, { align: 'center', width: signW - 20 });

        doc.rect(LEFT + signW + 20, y, signW, 45).fill('white').strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text('CONFORME PROVEEDOR (RECEPCIÓN DEL PEDIDO):', LEFT + signW + 30, y + 6);
        doc.moveTo(LEFT + signW + 30, y + 32).lineTo(LEFT + (signW * 2) + 10, y + 32).strokeColor('#94a3b8').lineWidth(0.5).stroke();
        doc.text('Firma y Sello de Conformidad', LEFT + signW + 30, y + 35, { align: 'center', width: signW - 20 });

        // ── 6. FOOTERS ─────────────────────────────────────────────
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const yFooter = doc.page.height - 25;
            doc.save();
            doc.moveTo(LEFT, yFooter).lineTo(LEFT + W, yFooter).strokeColor(BLUE).lineWidth(0.5).stroke();
            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
               .text(`Inversiones Lucem C.A. | RIF: J-40500250-6 | Orden de Compra Generada desde FINK`, LEFT, yFooter + 4, { width: W - 70, align: 'left', lineBreak: false });
            doc.text(`Página ${i + 1} de ${range.count}`, LEFT + W - 60, yFooter + 4, { width: 60, align: 'right', lineBreak: false });
            doc.restore();
        }

        doc.end();
    });
}
