const fs = require('fs');
let code = fs.readFileSync('src/services/telegram.service.ts', 'utf8');

const regexToRemove = /\/\/ 3\. Mandamos el texto al Cerebro.*bot\.sendMessage\(chatId, formatResponse, \{ parse_mode: 'Markdown' \}\);/ms;

const newStr = `      // Obtener todos los proyectos activos para darselos al LLM
      const activeProjects = await prisma.project.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });
      const defaultUser = await prisma.user.findFirst();

      if (!defaultUser || activeProjects.length === 0) {
        return bot.sendMessage(chatId, '❌ No se encontró usuario o proyecto activo.', { parse_mode: 'Markdown' });
      }

      const { parseFinancialTextToJSON } = require('./ai.service');
      const extractedData = await parseFinancialTextToJSON(textToProcess, {
        currentDate: new Date().toISOString().split('T')[0],
        projects: activeProjects
      });

      const parsedAmount = Number(extractedData.monto) || 0;
      let currency = 'BS';
      if (extractedData.moneda === 'USD' || extractedData.moneda === 'EUR') {
        currency = extractedData.moneda;
      }
      const theType = extractedData.tipo === 'gasto' ? 'EXPENSE' : 'INCOME';
      
      const parsedDate = extractedData.fecha ? new Date(extractedData.fecha) : new Date();

      // Buscar la tasa de cambio BCV más reciente
      const lastUsdRateRecord = await prisma.exchangeRate.findFirst({
        where: { source: 'BCV' },
        orderBy: { date: 'desc' }
      });
      const usdToBs = lastUsdRateRecord?.usdToBs || 1;
      const eurToBs = lastUsdRateRecord?.eurToBs || 1;
      
      let amountBs = parsedAmount;
      let amountUsd = 0;
      let amountEur = 0;
      
      if (currency === 'USD') {
        amountUsd = parsedAmount;
        amountBs = parsedAmount * usdToBs;
      } else if (currency === 'EUR') {
        amountEur = parsedAmount;
        amountBs = parsedAmount * eurToBs;
      } else {
        amountBs = parsedAmount;
        amountUsd = parsedAmount / usdToBs;
      }

      // Buscar el proyecto exacto devuelto por texto o ID
      let matchedProject = activeProjects.find(p => p.id === extractedData.proyecto_id);
      if (!matchedProject) matchedProject = activeProjects[0]; // fallback al primero

      const newTx = await prisma.transaction.create({
        data: {
          code: 'BOT-' + Date.now(),
          date: parsedDate,
          type: theType,
          description: extractedData.concepto || 'Transacción registrada por voz',
          projectId: matchedProject.id,
          currency: currency,
          amount: parsedAmount,
          amountBs: amountBs,
          amountUsd: amountUsd,
          amountEur: amountEur,
          exchangeRateId: lastUsdRateRecord?.id || null,
          userId: defaultUser.id,
          category: extractedData.categoria || 'General',
          tags: 'telegram-bot',
          attachments: '[]',
          status: 'COMPLETED',
          paymentStatus: 'PENDING',
          amountPaid: 0
        }
      });

      const formatResponse = \`✅ *¡Transacción Guardada Inteligente!*

💰 *Monto:* \${parsedAmount} \${currency}
🗓️ *Fecha:* \${parsedDate.toISOString().split('T')[0]}
📋 *Concepto:* \${extractedData.concepto}
🏷️ *Categoría:* \${extractedData.categoria}
🏦 *Pago:* \${extractedData.cuenta_origen}
🔄 *Tipo:* \${theType === 'EXPENSE' ? '🔴 Gasto' : '🟢 Ingreso'}
👨‍💻 *Proyecto:* \${matchedProject.name}
💱 *Tasa referencial:* \${usdToBs > 1 ? usdToBs.toFixed(2) + ' Bs/USD' : 'N/A'}\n
_(ID en sistema: \${newTx.code})_\`;

      bot.sendMessage(chatId, formatResponse, { parse_mode: 'Markdown' });\`;

code = code.replace(regexToRemove, newStr);
fs.writeFileSync('src/services/telegram.service.ts', code);
`
