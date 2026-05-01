import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import prisma from '../config/database';
import { transcribeAudioOGG } from './groq.service';

const pendingTransactions = new Map<number, any>();

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('⚠️ No se encontró TELEGRAM_BOT_TOKEN en .env. El Bot de Telegram está desactivado.');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  console.log('🤖 Bot de Telegram inicializado y escuchando...');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
      let textToProcess = '';

      if (msg.voice) {
        const waitMsg = await bot.sendMessage(chatId, '🎙️ Escuchando...');
        const fileLink = await bot.getFileLink(msg.voice.file_id);
        const audioResponse = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(audioResponse.data);

        textToProcess = await transcribeAudioOGG(audioBuffer);
        
        await bot.editMessageText(`Lo que escuché:\n_"${textToProcess}"_\n\n🧠 Pensando...`, {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: 'Markdown'
        });

      } 
      else if (msg.text) {
        if (msg.text === '/start') {
          return bot.sendMessage(chatId, '¡Hola! Soy tu asistente de Fink. Envíame un audio (o texto) con una transacción (ingreso, gasto o transferencia).');
        }
        textToProcess = msg.text;
        await bot.sendMessage(chatId, '🧠 Pensando...');
      } 
      else {
        return;
      }

      if (!textToProcess) return;

      const activeProjects = await prisma.project.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } });
      const activeContacts = await prisma.contactPerson.findMany({ 
        where: { isActive: true },
        select: { id: true, name: true } 
      });
      const activeAccounts = await prisma.account.findMany({
        select: { id: true, name: true, projectId: true, currency: true }
      });
      const defaultUser = await prisma.user.findFirst();

      if (!defaultUser || activeProjects.length === 0) {
        return bot.sendMessage(chatId, '❌ No se encontró usuario o proyecto activo.', { parse_mode: 'Markdown' });
      }

      const { parseFinancialTextToJSON } = require('./ai.service');
        // Ajuste de zona horaria a Venezuela (UTC-4) para evitar brincos de día en la noche
        const currentDateVe = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().split('T')[0];
        const extractedData = await parseFinancialTextToJSON(textToProcess, {
          currentDate: currentDateVe,
        projects: activeProjects,
        contacts: activeContacts,
        accounts: activeAccounts
      });

      let parsedAmount = Number(extractedData.monto) || 0;
      let finalCurrency = 'BS'; 
      if (extractedData.moneda_final === 'USD' || extractedData.moneda_final === 'EUR') {
        finalCurrency = extractedData.moneda_final;
      } else if (!extractedData.moneda_final && (extractedData.moneda_dictada === 'USD' || extractedData.moneda_dictada === 'EUR')) {
        finalCurrency = extractedData.moneda_dictada;
      }

      const rawType = extractedData.tipo || '';
      let theType = 'EXPENSE';
      if (rawType.toLowerCase() === 'ingreso') theType = 'INCOME';
      if (rawType.toLowerCase() === 'transferencia') theType = 'TRANSFER';

      const originAcc = extractedData.cuenta_origen_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_origen_id) : null;
      const destAcc = extractedData.cuenta_destino_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_destino_id) : null;
      
      if (theType === 'TRANSFER' && originAcc && destAcc && originAcc.currency === destAcc.currency) {
           finalCurrency = originAcc.currency;
      } else if (theType === 'EXPENSE' && originAcc && originAcc.currency) {
           finalCurrency = originAcc.currency;
      } else if (theType === 'INCOME' && destAcc && destAcc.currency) {
           finalCurrency = destAcc.currency;
      }

const parsedDate = extractedData.fecha ? new Date(extractedData.fecha) : new Date(Date.now() - 4 * 60 * 60 * 1000);

      const queryDate = new Date(parsedDate);
      queryDate.setHours(23, 59, 59, 999);

      const lastUsdRateRecord = await prisma.exchangeRate.findFirst({
        where: { 
          source: 'BCV',
          date: { lte: queryDate }
        },
        orderBy: { date: 'desc' }
      });
      
      const usdToBs = lastUsdRateRecord?.usdToBs || 1;
      const eurToBs = lastUsdRateRecord?.eurToBs || 1;

      const dictada = extractedData.moneda_dictada || finalCurrency;
      if (dictada === 'USD' && finalCurrency === 'BS') {
          parsedAmount = parsedAmount * usdToBs;
      } else if (dictada === 'EUR' && finalCurrency === 'BS') {
          parsedAmount = parsedAmount * eurToBs;
      } else if (dictada === 'BS' && finalCurrency === 'USD') {
          parsedAmount = parsedAmount / usdToBs;
      }
      
      parsedAmount = Number(parsedAmount.toFixed(2));

      let amountBs = parsedAmount;
      let amountUsd = 0;
      let amountEur = 0;
      
      if (finalCurrency === 'USD') {
        amountUsd = parsedAmount;
        amountBs = parsedAmount * usdToBs;
      } else if (finalCurrency === 'EUR') {
        amountEur = parsedAmount;
        amountBs = parsedAmount * eurToBs;
      } else {
        amountBs = parsedAmount;
        amountUsd = parsedAmount / usdToBs;
      }

      let matchedProjectToUseId = extractedData.proyecto_id;
      if (!matchedProjectToUseId) {
        if (theType === 'TRANSFER' && extractedData.cuenta_origen_id) {
          const originAccount = activeAccounts.find(a => a.id === extractedData.cuenta_origen_id);
          if (originAccount && originAccount.projectId) {
            matchedProjectToUseId = originAccount.projectId;
          }
        }
      }

      let matchedProject = activeProjects.find(p => p.id === matchedProjectToUseId);
      if (!matchedProject) matchedProject = activeProjects[0]; 

      let matchedContact = null;
      if (extractedData.contacto_id) {
        matchedContact = activeContacts.find((c: any) => c.id === extractedData.contacto_id);
      }

      const entriesToCreate: any[] = [];

      // Validar los IDs de cuenta para evitar errores de Foreign Key
      const validOrigen = (extractedData.cuenta_origen_id && activeAccounts.find((a) => a.id === extractedData.cuenta_origen_id)) ? extractedData.cuenta_origen_id : null;
      const validDestino = (extractedData.cuenta_destino_id && activeAccounts.find((a) => a.id === extractedData.cuenta_destino_id)) ? extractedData.cuenta_destino_id : null;

      if (theType === 'TRANSFER') {
        if (validDestino) {
          entriesToCreate.push({
            debitAccountId: validDestino,
            debitAmount: parsedAmount
          });
        }
        if (validOrigen) {
          entriesToCreate.push({
            creditAccountId: validOrigen,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'EXPENSE') {
        if (validOrigen) {
          entriesToCreate.push({
            creditAccountId: validOrigen,
            creditAmount: parsedAmount
          });
        }
      } else if (theType === 'INCOME') {
        if (validDestino) {
          entriesToCreate.push({
            debitAccountId: validDestino,
            debitAmount: parsedAmount
          });
        }
      }

      const transactionData: any = {
        code: 'BOT-' + Date.now(),
        date: parsedDate,
        type: theType,
        description: extractedData.concepto || 'Transacción registrada por voz',
        projectId: matchedProject.id,
        contactPersonId: matchedContact ? matchedContact.id : null,
        currency: finalCurrency,
        amount: parsedAmount,
        amountBs: amountBs,
        amountUsd: amountUsd,
        amountEur: amountEur,
        exchangeRateId: lastUsdRateRecord?.id || null,
        userId: defaultUser.id,
        category: extractedData.categoria || 'General',
        tags: '["telegram-bot"]',
        attachments: '[]',
        status: 'COMPLETED',
        paymentStatus: 'PENDING',
        amountPaid: 0
      };

      if (entriesToCreate.length > 0) {
         transactionData.entries = { create: entriesToCreate };
      }

      let typeIcon = '🔴 Gasto';
      if (theType === 'INCOME') typeIcon = '🟢 Ingreso';
      if (theType === 'TRANSFER') typeIcon = '🔄 Transferencia';

      let accountsInfoStr = "🏦 *Origen:* " + (extractedData.cuenta_origen || 'No detectado');
      if (theType === 'TRANSFER' || theType === 'INCOME') {
         accountsInfoStr += "\n🏦 *Destino:* " + (extractedData.cuenta_destino || 'No detectado');
      }

        let projectDisplay = matchedProject.name;
        if (theType === 'TRANSFER' && destAcc && destAcc.projectId) {
            const destProject = activeProjects.find((p: any) => p.id === destAcc.projectId);
            if (destProject && destProject.id !== matchedProject.id) {
                projectDisplay = `${matchedProject.name} ➡️ ${destProject.name}`;
            }
        }

        const formatResponse = "🤖 *Revisión de Transacción Inteligente*\n\n" +
          "💰 *Monto:* " + parsedAmount + " " + finalCurrency + "\n" +
          "🗓️ *Fecha:* " + parsedDate.toISOString().split('T')[0] + "\n" +
          "📋 *Concepto:* " + extractedData.concepto + "\n" +
          "🏷️ *Categoría:* " + extractedData.categoria + "\n" +
          accountsInfoStr + "\n" +
          "🔃 *Tipo:* " + typeIcon + "\n" +
          "👨‍💻 *Proyecto:* " + projectDisplay + "\n" +
        "👤 *Contacto:* " + (matchedContact ? matchedContact.name : 'N/A') + "\n" +
        "💱 *Tasa referencial (" + queryDate.toISOString().split('T')[0] + "):* " + (usdToBs > 1 ? usdToBs.toFixed(2) + ' Bs/USD' : 'N/A') + "\n\n" +
        "¿Estás de acuerdo con este resultado?";

      pendingTransactions.set(chatId, transactionData);

      bot.sendMessage(chatId, formatResponse, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Sí, guardar', callback_data: 'save_tx' },
              { text: '❌ No, cancelar', callback_data: 'cancel_tx' }
            ]
          ]
        }
      });

    } catch (error: any) {
      console.error(error);
      bot.sendMessage(chatId, `❌ Ups, ocurrió un error: ${error.message}`);
    }
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    if (query.data === 'save_tx') {
      const txData = pendingTransactions.get(chatId);
      if (txData) {
        try {
          const isTransfer = txData.type === 'TRANSFER';

          if (isTransfer) {
            txData.paymentStatus = 'PAID';
            txData.amountPaid = txData.amount;
          } else {
            txData.paymentStatus = 'PENDING';
            txData.amountPaid = 0;
          }
          
          console.log("SENDING TO PRISMA:", JSON.stringify(txData, null, 2));
          console.log("SENDING TO PRISMA:", JSON.stringify(txData, null, 2));
          const newTx = await prisma.transaction.create({ 
            data: txData,
            include: { entries: true } 
          });

          if (isTransfer) {
            // Auto-ejecutar el pago solo si es TRANSFERENCIA
            const payment = await prisma.payment.create({
              data: {
                project: { connect: { id: newTx.projectId } },
                code: "PAY-" + newTx.projectId.substring(0,6) + "-" + Date.now(),
                date: newTx.date,
                currency: newTx.currency,
                amount: newTx.amount,
                method: 'BANK_TRANSFER',
                status: 'COMPLETED',
                user: { connect: { id: newTx.userId } },
              }
            });

            // Conectar pago con transaccion
            await prisma.paymentAllocation.create({
              data: {
                payment: { connect: { id: payment.id } },
                transaction: { connect: { id: newTx.id } },
                allocatedAmount: newTx.amount,
              }
            });

            // Actualizar saldos de los bancos!
            const { updateAccountBalance } = require('./account.service');
            for (const entry of newTx.entries) {
              if (entry.debitAccountId && entry.debitAmount > 0) {
                await updateAccountBalance(entry.debitAccountId, newTx.currency, entry.debitAmount, 'DEBIT');
              }
              if (entry.creditAccountId && entry.creditAmount > 0) {
                await updateAccountBalance(entry.creditAccountId, newTx.currency, entry.creditAmount, 'CREDIT');
              }
            }
          }
          
          let typeWord = 'Gasto';
          if (txData.type === 'INCOME') typeWord = 'Ingreso';
          if (txData.type === 'TRANSFER') typeWord = 'Transferencia';

          const confirmText = `✅ *¡${typeWord} Guardado Inteligente!*\n\n💰 *Monto:* ${txData.amount} ${txData.currency}\n📋 *Concepto:* ${txData.description}\n\n_(ID en sistema: ${newTx.code})_`;
          
          await bot.editMessageText(confirmText, {
            chat_id: chatId,
            message_id: query.message?.message_id,
            parse_mode: 'Markdown'
          });
          pendingTransactions.delete(chatId);
        } catch (error: any) {
          await bot.sendMessage(chatId, `❌ Error al guardar en base de datos: ${error.message}\nDATA ENVIADA: \n\`\`\`json\n${JSON.stringify(txData, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
        }
      } else {
        await bot.sendMessage(chatId, '❌ No encontré la transacción pendiente. Podría haber expirado o ya fue procesada.');
      }
    } else if (query.data === 'cancel_tx') {
      pendingTransactions.delete(chatId);
      await bot.editMessageText('❌ Transacción cancelada por el usuario.', {
        chat_id: chatId,
        message_id: query.message?.message_id
      });
    }

    if (query.id) {
        bot.answerCallbackQuery(query.id).catch(console.error);
    }
  });
};

