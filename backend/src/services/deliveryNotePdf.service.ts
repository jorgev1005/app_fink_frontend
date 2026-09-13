import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface DeliveryNoteItem {
    sku?: string;
    description: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    total?: number;
    empaqueCantidad?: number;
    unidadEmpaque?: string;
    notes?: string;
}

export interface DeliveryNotePDFOptions {
    noteNumber: string;
    clientName: string;
    clientTaxId?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientAddress?: string;
    destinationCity?: string;
    companyName?: string;
    companyTaxId?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    deliveryAddress?: string;
    issueDate?: string;
    tasaBCV?: number;
    items: DeliveryNoteItem[];
    showPrices?: boolean;
    notes?: string;
}

export async function generateDeliveryNotePDFBuffer(options: DeliveryNotePDFOptions): Promise<{ buffer: Buffer; noteNumber: string }> {
    const {
        noteNumber,
        clientName,
        clientTaxId,
        clientPhone,
        clientEmail,
        clientAddress,
        destinationCity,
        companyName = 'Inversiones Lucem C.A. / Grupo Aludra',
        companyTaxId = 'J-40500250-6',
        companyAddress = 'Ciudad de La Victoria, Estado Aragua, Venezuela',
        companyPhone = '+58 412-271-1859',
        companyEmail = 'admin@grupoaludra.com',
        deliveryAddress,
        issueDate,
        tasaBCV,
        items,
        showPrices = false,
        notes
    } = options;

    const qrUrl = `https://wa.me/584122711859?text=${encodeURIComponent(`Consulta Nota de Entrega ${noteNumber} - ${clientName}`)}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
        margin: 1,
        width: 140,
        color: { dark: '#0f172a', light: '#ffffff' }
    });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
            bufferPages: true,
            info: { Title: noteNumber, Author: companyName }
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk: any) => buffers.push(chunk));
        doc.on('end', () => resolve({ buffer: Buffer.concat(buffers), noteNumber }));
        doc.on('error', (err: any) => reject(err));

        const PRIMARY = '#0284c7'; // Azul corporativo despacho
        const DARK    = '#0f172a'; // Gris pizarra oscuro
        const GRAY    = '#64748b'; // Slate 500
        const LGRAY  = '#f8fafc'; // Slate 50
        const BORDER  = '#e2e8f0'; // Slate 200
        const W       = doc.page.width - 90; // 505.28 pt
        const LEFT    = 45;

        const fmtDate = (dateStr?: string) => {
            if (!dateStr) return new Date().toLocaleDateString('es-VE');
            try {
                return new Date(dateStr).toLocaleDateString('es-VE');
            } catch (_) {
                return dateStr;
            }
        };

        // ── 1. ENCABEZADO CORPORATIVO OSCURO ──────────────────────
        doc.rect(LEFT, 40, W, 85).fill(DARK);

        doc.fontSize(20).fillColor('#38bdf8').font('Helvetica-Bold')
           .text('NOTA DE ENTREGA', LEFT + 20, 52, { lineBreak: false });

        doc.fontSize(8.5).fillColor('white').font('Helvetica-Bold')
           .text(companyName.toUpperCase(), LEFT + 20, 76, { lineBreak: false });

        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
           .text(`RIF: ${companyTaxId}  |  ${companyAddress}`, LEFT + 20, 88, { lineBreak: false })
           .text(`Tel: ${companyPhone}  |  ${companyEmail}`, LEFT + 20, 98, { lineBreak: false });

        // Bloque derecho: Número y fechas
        doc.fontSize(14).fillColor('#38bdf8').font('Helvetica-Bold')
           .text(noteNumber, 330, 52, { width: 200, align: 'right', lineBreak: false });
        doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica')
           .text(`Fecha de Emisión: ${fmtDate(issueDate)}`, 330, 72, { width: 200, align: 'right', lineBreak: false })
           .text(`Documento de Despacho y Custodia`, 330, 84, { width: 200, align: 'right', lineBreak: false })
           .text(tasaBCV ? `Tasa Ref. BCV: Bs. ${Number(tasaBCV).toFixed(2)}` : 'Validez Comercial Oficial', 330, 96, { width: 200, align: 'right', lineBreak: false });

        // ── 2. DESTINATARIO Y LUGAR DE ENTREGA (2 COLUMNAS) ──────
        let y = 135;
        const boxW = (W - 10) / 2;

        // Caja Destinatario / Cliente
        const boxH = 68;
        doc.rect(LEFT, y, boxW, boxH).fill(LGRAY);
        doc.rect(LEFT, y, 4, boxH).fill(PRIMARY);
        doc.fontSize(6.5).fillColor(PRIMARY).font('Helvetica-Bold')
           .text('CONSIGNADO / CLIENTE:', LEFT + 10, y + 6, { lineBreak: false });
        doc.fontSize(8.5).fillColor(DARK).font('Helvetica-Bold')
           .text(clientName.toUpperCase(), LEFT + 10, y + 16, { width: boxW - 16, ellipsis: true });

        const clientDocPhone = [
            clientTaxId ? `RIF/CI: ${clientTaxId}` : '',
            clientPhone ? `Tel: ${clientPhone}` : ''
        ].filter(Boolean).join('   |   ');

        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text(clientDocPhone || 'Cliente Registrado', LEFT + 10, y + 29, { width: boxW - 16, lineBreak: false });
        
        if (clientEmail) {
            doc.text(`Email: ${clientEmail}`, LEFT + 10, y + 39, { width: boxW - 16, ellipsis: true });
        }
        if (clientAddress) {
            doc.fontSize(6).fillColor('#4b5563')
               .text(`Dir: ${clientAddress}`, LEFT + 10, clientEmail ? y + 49 : y + 40, { width: boxW - 16, height: 16, ellipsis: true });
        }

        // Caja Lugar de Despacho y Recepción
        const col2X = LEFT + boxW + 10;
        doc.rect(col2X, y, boxW, boxH).fill(LGRAY);
        doc.rect(col2X, y, 4, boxH).fill('#10b981'); // Verde
        doc.fontSize(6.5).fillColor('#059669').font('Helvetica-Bold')
           .text('CONDICIÓN Y DESTINO DE DESPACHO:', col2X + 10, y + 6, { lineBreak: false });
        
        const destTitle = destinationCity ? `Destino: ${destinationCity.toUpperCase()}` : (deliveryAddress || 'Recepción en Almacén / Transporte');
        doc.fontSize(8).fillColor(DARK).font('Helvetica-Bold')
           .text(destTitle, col2X + 10, y + 16, { width: boxW - 16, ellipsis: true });

        doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
           .text('Verificar mercancía, bultos y precintos al momento de recibir.', col2X + 10, y + 33, { width: boxW - 16, lineBreak: false })
           .text('Firma y sello requeridos en el talón de conformidad inferior.', col2X + 10, y + 44, { width: boxW - 16, lineBreak: false });

        y += boxH + 10;

        // ── 3. TABLA DE ÍTEMS DESPACHADOS ─────────────────────────
        const cols = {
            sku: LEFT,
            desc: LEFT + (showPrices ? 85 : 95),
            cant: LEFT + (showPrices ? 285 : 365),
            bultos: LEFT + (showPrices ? 335 : 430),
            precio: LEFT + 385,
            total: LEFT + 440
        };

        const colWidths = {
            sku: showPrices ? 80 : 90,
            desc: showPrices ? 195 : 265,
            cant: showPrices ? 45 : 60,
            bultos: showPrices ? 45 : 75,
            precio: 50,
            total: 65
        };

        function drawTableHeader(currentY: number) {
            doc.rect(LEFT, currentY, W, 16).fill(DARK);
            doc.fontSize(6.5).fillColor('white').font('Helvetica-Bold');
            doc.text('SKU / CÓDIGO', cols.sku + 3, currentY + 5, { width: colWidths.sku, lineBreak: false });
            doc.text('DESCRIPCIÓN DE LA MERCANCÍA', cols.desc + 3, currentY + 5, { width: colWidths.desc, lineBreak: false });
            doc.text('CANTIDAD', cols.cant, currentY + 5, { width: colWidths.cant, align: 'center', lineBreak: false });
            doc.text('EMPAQUE / BULTOS', cols.bultos, currentY + 5, { width: colWidths.bultos, align: 'center', lineBreak: false });
            if (showPrices) {
                doc.text('P.U. ($)', cols.precio, currentY + 5, { width: colWidths.precio, align: 'right', lineBreak: false });
                doc.text('TOTAL ($)', cols.total, currentY + 5, { width: colWidths.total, align: 'right', lineBreak: false });
            }
            return currentY + 16;
        }

        y = drawTableHeader(y);

        let totalUnidades = 0;
        let totalBultos = 0;
        let totalMonto = 0;

        items.forEach((item, idx) => {
            const qty = item.quantity || 1;
            const unitPrice = item.unitPrice || 0;
            const lineTotal = item.total || (unitPrice * qty);

            totalUnidades += qty;
            totalMonto += lineTotal;

            const empaqQty = item.empaqueCantidad && item.empaqueCantidad > 1 ? item.empaqueCantidad : 0;
            let bultosStr = '—';
            if (empaqQty > 0) {
                const bVal = qty / empaqQty;
                totalBultos += bVal;
                const unidad = item.unidadEmpaque || 'bulto';
                bultosStr = `${Number(bVal.toFixed(2)).toLocaleString('es-VE')} ${bVal === 1 ? unidad : `${unidad}s`}`;
            }

            doc.fontSize(7).font('Helvetica');
            const descHeight = doc.heightOfString(item.description, { width: colWidths.desc - 5 });
            doc.fontSize(6.5).font('Helvetica-Bold');
            const skuHeight = doc.heightOfString(item.sku || 'N/A', { width: colWidths.sku - 4 });
            const rowHeight = Math.max(18, Math.max(descHeight, skuHeight) + 6);

            // Verificar salto de página
            if (y + rowHeight > doc.page.height - 130) {
                doc.addPage();
                y = 40;
                y = drawTableHeader(y);
            }

            // Fila con fondo alternado
            if (idx % 2 === 1) {
                doc.rect(LEFT, y, W, rowHeight).fill('#f8fafc');
            }
            doc.rect(LEFT, y, W, rowHeight).stroke(BORDER);

            doc.fontSize(6.5).fillColor(DARK).font('Helvetica-Bold')
               .text(item.sku || 'N/A', cols.sku + 3, y + 4, { width: colWidths.sku - 4 });

            doc.fontSize(7).fillColor(DARK).font('Helvetica')
               .text(item.description, cols.desc + 3, y + 4, { width: colWidths.desc - 5 });

            doc.fontSize(7.5).fillColor(DARK).font('Helvetica-Bold')
               .text(qty.toLocaleString('es-VE'), cols.cant, y + 4, { width: colWidths.cant, align: 'center', lineBreak: false });

            doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
               .text(bultosStr, cols.bultos, y + 4, { width: colWidths.bultos, align: 'center', lineBreak: false });

            if (showPrices) {
                doc.fontSize(7).fillColor(DARK).font('Helvetica')
                   .text(`$${unitPrice.toFixed(2)}`, cols.precio, y + 4, { width: colWidths.precio - 4, align: 'right', lineBreak: false });
                doc.fontSize(7.5).fillColor(DARK).font('Helvetica-Bold')
                   .text(`$${lineTotal.toFixed(2)}`, cols.total, y + 4, { width: colWidths.total - 4, align: 'right', lineBreak: false });
            }

            y += rowHeight;
        });

        // Fila de Totales de la Tabla
        doc.rect(LEFT, y, W, 18).fill('#f1f5f9');
        doc.rect(LEFT, y, W, 18).stroke(BORDER);
        doc.fontSize(7).fillColor(DARK).font('Helvetica-Bold')
           .text('TOTAL GENERAL DE CARGA:', LEFT + 10, y + 5, { lineBreak: false });

        doc.fontSize(8).fillColor(PRIMARY).font('Helvetica-Bold')
           .text(`${totalUnidades.toLocaleString('es-VE')} Unidades`, cols.cant - 20, y + 5, { width: 85, align: 'center', lineBreak: false });

        if (totalBultos > 0) {
            doc.fontSize(7.5).fillColor(DARK).font('Helvetica-Bold')
               .text(`${Number(totalBultos.toFixed(2)).toLocaleString('es-VE')} Bultos`, cols.bultos, y + 5, { width: colWidths.bultos, align: 'center', lineBreak: false });
        }

        if (showPrices) {
            doc.fontSize(8.5).fillColor('#059669').font('Helvetica-Bold')
               .text(`$${totalMonto.toFixed(2)}`, cols.total, y + 4, { width: colWidths.total - 4, align: 'right', lineBreak: false });
        }

        y += 28;

        // ── 4. TALÓN DE RECEPCIÓN Y CONFORMIDAD (PIE DE PÁGINA) ───
        const footerY = Math.max(y, doc.page.height - 115);

        // QR a la derecha
        doc.image(qrBuffer, LEFT + W - 65, footerY, { width: 65, height: 65 });
        doc.fontSize(5.5).fillColor(GRAY).font('Helvetica')
           .text('Escanear para verificar despacho', LEFT + W - 75, footerY + 68, { width: 85, align: 'center', lineBreak: false });

        // Bloques de firmas
        const signW = (W - 85) / 2;

        // Firma Entrega / Chofer
        doc.rect(LEFT, footerY, signW, 55).stroke(BORDER);
        doc.fontSize(6).fillColor(GRAY).font('Helvetica-Bold')
           .text('ENTREGADO POR (ALMACÉN / TRANSPORTE):', LEFT + 6, footerY + 5, { lineBreak: false });
        doc.text('Nombre / Chofer: _________________________________', LEFT + 6, footerY + 22, { lineBreak: false });
        doc.text('C.I. / Placa:     _________________________________', LEFT + 6, footerY + 34, { lineBreak: false });
        doc.text('Firma:            _________________________________', LEFT + 6, footerY + 45, { lineBreak: false });

        // Firma Receptor / Cliente
        const sign2X = LEFT + signW + 10;
        doc.rect(sign2X, footerY, signW, 55).stroke(BORDER);
        doc.fontSize(6).fillColor(GRAY).font('Helvetica-Bold')
           .text('RECIBIDO CONFORME (CLIENTE / DESTINO):', sign2X + 6, footerY + 5, { lineBreak: false });
        doc.text('Nombre y Apellido: _______________________________', sign2X + 6, footerY + 22, { lineBreak: false });
        doc.text('C.I. / RIF:        _______________________________', sign2X + 6, footerY + 34, { lineBreak: false });
        doc.text('Firma y Sello:     _______________________________', sign2X + 6, footerY + 45, { lineBreak: false });

        doc.fontSize(5.5).fillColor('#94a3b8').font('Helvetica')
           .text('La firma en este documento certifica la recepción a entera satisfacción del material y las cantidades descritas.', LEFT, footerY + 62, { lineBreak: false });

        doc.end();
    });
}
