import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import prisma from '../config/database';
import { transcribeAudioOGG } from './groq.service';
import { parseFinancialTextToJSON } from './ai.service';

const pendingTransactions = new Map<number, any>();

type BotCurrency = 'BS' | 'USD' | 'EUR';

type MonetaryMention = {
  amount: number;
  currency: BotCurrency;
  index: number;
};

type FxTransferDetails = {
  sourceAmount: number;
  sourceCurrency: BotCurrency;
  targetAmount: number;
  targetCurrency: BotCurrency;
  effectiveUsdToBs?: number;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
};

const normalizeForMatch = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseSpanishNumber = (rawValue: string): number => {
  const raw = (rawValue || '').trim().replace(/\s+/g, '');
  if (!raw) return 0;

  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');

  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    if (lastComma > lastDot) {
      return Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return Number(raw.replace(/,/g, '')) || 0;
  }

  if (hasDot) {
    const parts = raw.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      return Number(parts.join('')) || 0;
    }
  }

  if (hasComma) {
    const parts = raw.split(',');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      return Number(parts.join('')) || 0;
    }
    return Number(raw.replace(',', '.')) || 0;
  }

  return Number(raw) || 0;
};

const normalizeCurrencyToken = (token?: string | null): BotCurrency | null => {
  const normalized = normalizeForMatch(token);
  if (!normalized) return null;
  if (normalized.includes('usdt') || normalized.includes('usd') || normalized.includes('dolar')) return 'USD';
  if (normalized.includes('eur') || normalized.includes('euro')) return 'EUR';
  if (normalized.includes('bs') || normalized.includes('bolivar')) return 'BS';
  return null;
};

const extractMonetaryMentions = (text: string): MonetaryMention[] => {
  const matches: MonetaryMention[] = [];
  const regex = /(\d[\d.,]*)\s*(usdt|usd|dolares?|dólares?|eur|euros?|bs|bolivares?|bolívares?)/gi;

  for (const match of text.matchAll(regex)) {
    const amount = parseSpanishNumber(match[1]);
    const currency = normalizeCurrencyToken(match[2]);
    if (!amount || !currency) continue;
    matches.push({
      amount,
      currency,
      index: match.index || 0,
    });
  }

  return matches;
};

const findProjectScopedAccount = (
  accounts: Array<{ id: string; name: string; projectId: string | null; currency: string }>,
  projectId: string,
  preferredId?: string | null,
  preferredName?: string | null,
) => {
  if (preferredId) {
    const direct = accounts.find(account => account.id === preferredId && account.projectId === projectId);
    if (direct) return direct;
  }

  const normalizedPreferredName = normalizeForMatch(preferredName);
  if (!normalizedPreferredName) return null;

  return (
    accounts.find(account => {
      if (account.projectId !== projectId) return false;
      const normalizedAccountName = normalizeForMatch(account.name);
      return normalizedAccountName.includes(normalizedPreferredName) || normalizedPreferredName.includes(normalizedAccountName);
    }) || null
  );
};

const inferFxTransferDetails = (
  text: string,
  originAccount: { id: string; currency: string } | null,
  destinationAccount: { id: string; currency: string } | null,
): FxTransferDetails | null => {
  const mentions = extractMonetaryMentions(text);
  if (mentions.length < 2) return null;

  const sourceCurrency = mentions[0].currency || normalizeCurrencyToken(originAccount?.currency);
  const targetCurrency = mentions.find(m => m.currency !== sourceCurrency)?.currency || mentions[mentions.length - 1].currency || normalizeCurrencyToken(destinationAccount?.currency);

  if (!sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return null;

  const sourceMention = mentions.find(mention => mention.currency === sourceCurrency);
  const targetMention = [...mentions].reverse().find(mention => mention.currency === targetCurrency);

  if (!sourceMention || !targetMention) return null;

  const fxDetails: FxTransferDetails = {
    sourceAmount: sourceMention.amount,
    sourceCurrency,
    targetAmount: targetMention.amount,
    targetCurrency,
    sourceAccountId: originAccount?.id || null,
    destinationAccountId: destinationAccount?.id || null,
  };

  const bsMention = mentions.find(mention => mention.currency === 'BS');
  const usdMention = mentions.find(mention => mention.currency === 'USD');
  if (bsMention && usdMention && usdMention.amount > 0) {
    fxDetails.effectiveUsdToBs = Number((bsMention.amount / usdMention.amount).toFixed(4));
  }

  return fxDetails;
};

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('⚠️ No se encontró TELEGRAM_BOT_TOKEN en .env. El Bot de Telegram está desactivado.');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  bot.on('polling_error', (err) => console.log('Telegram Polling warning:', err.message));
  console.log('🤖 Bot de Telegram inicializado y escuchando...');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    try {
      let textToProcess = '';

      if (msg.voice) {
        const waitMsg = await bot.sendMessage(chatId, '🎙️ Escuchando...');
        
        let audioBuffer = null;
        let fileLink = '';
        let dlAttempts = 0;
        while (dlAttempts < 3) {
          try {
            fileLink = await bot.getFileLink(msg.voice.file_id);
            const audioResponse = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 15000 });
            audioBuffer = Buffer.from(audioResponse.data);
            break;
          } catch(e) {
            dlAttempts++;
            if (dlAttempts >= 3) {
                // If it fails after 3, let the global try/catch get it but translate ECONNRESET
                throw new Error("No se pudo descargar el audio de Telegram por inestabilidad de red (ECONNRESET/EFATAL). Por favor intenta de nuevo.");
            }
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (!audioBuffer) throw new Error('Audio no encontrado');
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

      // Ajustar la fecha base a la recibida por Telegram (msg.date viene en segundos UTC)
      // Lo transformamos a UTC-4 para pasárselo al asistente como fecha/hora actual local.
      const msgDateMs = msg.date ? msg.date * 1000 : Date.now();
      const currentDateVeMs = new Date(msgDateMs - 4 * 60 * 60 * 1000);
      const currentDateVe = currentDateVeMs.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss

      const extractedData = await parseFinancialTextToJSON(textToProcess, {
        currentDate: currentDateVe,
        projects: activeProjects,
        contacts: activeContacts,
        accounts: activeAccounts
      });

      let parsedAmount = Number(extractedData.monto) || 0;
      let finalCurrency: BotCurrency = 'BS'; 
      if (extractedData.moneda_final === 'USD' || extractedData.moneda_final === 'EUR') {
        finalCurrency = extractedData.moneda_final;
      } else if (!extractedData.moneda_final && (extractedData.moneda_dictada === 'USD' || extractedData.moneda_dictada === 'EUR')) {
        finalCurrency = extractedData.moneda_dictada;
      }

      const rawType = extractedData.tipo || '';
      let theType = 'EXPENSE';
      if (rawType.toLowerCase() === 'ingreso') theType = 'INCOME';
      if (rawType.toLowerCase() === 'transferencia') theType = 'TRANSFER';

      const preliminaryOriginAcc = extractedData.cuenta_origen_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_origen_id) : null;
      const preliminaryDestAcc = extractedData.cuenta_destino_id ? activeAccounts.find((a:any) => a.id === extractedData.cuenta_destino_id) : null;

      let matchedProjectToUseId = extractedData.proyecto_id;
      if (!matchedProjectToUseId && theType === 'TRANSFER' && preliminaryOriginAcc?.projectId) {
        matchedProjectToUseId = preliminaryOriginAcc.projectId;
      }

      let matchedProject = activeProjects.find(p => p.id === matchedProjectToUseId);
      if (!matchedProject) matchedProject = activeProjects[0];

      const projectOriginAcc = findProjectScopedAccount(activeAccounts as any, matchedProject.id, extractedData.cuenta_origen_id, extractedData.cuenta_origen);
      const projectDestAcc = findProjectScopedAccount(activeAccounts as any, matchedProject.id, extractedData.cuenta_destino_id, extractedData.cuenta_destino);

      const originAcc = projectOriginAcc || preliminaryOriginAcc;
      const destAcc = projectDestAcc || preliminaryDestAcc;

      if (theType === 'TRANSFER' && originAcc && destAcc && originAcc.currency === destAcc.currency) {
        finalCurrency = normalizeCurrencyToken(originAcc.currency) || finalCurrency;
      } else if (theType === 'EXPENSE' && originAcc?.currency) {
        finalCurrency = normalizeCurrencyToken(originAcc.currency) || finalCurrency;
      } else if (theType === 'INCOME' && destAcc?.currency) {
        finalCurrency = normalizeCurrencyToken(destAcc.currency) || finalCurrency;
      }

      const parsedDate = extractedData.fecha ? new Date(extractedData.fecha) : new Date(msgDateMs - 4 * 60 * 60 * 1000);

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

        const dictada = (normalizeCurrencyToken(extractedData.moneda_dictada) || finalCurrency) as BotCurrency;
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
      let effectiveRate = usdToBs;
      
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

      let matchedContact = null;
      if (extractedData.contacto_id) {
        matchedContact = activeContacts.find((c: any) => c.id === extractedData.contacto_id);
      }

      const fxTransfer = theType === 'TRANSFER'
        ? inferFxTransferDetails(textToProcess, originAcc as any, destAcc as any)
        : null;

      if (fxTransfer) {
        parsedAmount = fxTransfer.sourceAmount;
        finalCurrency = fxTransfer.sourceCurrency;
        amountBs = fxTransfer.targetCurrency === 'BS'
          ? fxTransfer.targetAmount
          : fxTransfer.sourceCurrency === 'BS'
            ? fxTransfer.sourceAmount
            : finalCurrency === 'USD'
              ? Number((fxTransfer.sourceAmount * (fxTransfer.effectiveUsdToBs || usdToBs)).toFixed(2))
              : amountBs;
        amountUsd = fxTransfer.sourceCurrency === 'USD'
          ? fxTransfer.sourceAmount
          : fxTransfer.targetCurrency === 'USD'
            ? fxTransfer.targetAmount
            : amountBs > 0 && (fxTransfer.effectiveUsdToBs || usdToBs) > 0
              ? Number((amountBs / (fxTransfer.effectiveUsdToBs || usdToBs)).toFixed(2))
              : amountUsd;
        amountEur = fxTransfer.sourceCurrency === 'EUR'
          ? fxTransfer.sourceAmount
          : fxTransfer.targetCurrency === 'EUR'
            ? fxTransfer.targetAmount
            : amountEur;
        if (fxTransfer.effectiveUsdToBs) {
          effectiveRate = fxTransfer.effectiveUsdToBs;
        }
      }

      const entriesToCreate: any[] = [];

      // Validar los IDs de cuenta para evitar errores de Foreign Key
      const validOrigen = originAcc?.id || null;
      const validDestino = destAcc?.id || null;

      if (theType === 'TRANSFER') {
        if (validDestino) {
          entriesToCreate.push({
            debitAccountId: validDestino,
            debitAmount: fxTransfer ? fxTransfer.targetAmount : parsedAmount
          });
        }
        if (validOrigen) {
          entriesToCreate.push({
            creditAccountId: validOrigen,
            creditAmount: fxTransfer ? fxTransfer.sourceAmount : parsedAmount
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

      if (fxTransfer) {
        transactionData._botFx = {
          ...fxTransfer,
          sourceAccountId: validOrigen,
          destinationAccountId: validDestino,
        };
      }

      if (entriesToCreate.length > 0) {
         transactionData.entries = { create: entriesToCreate };
      }

      let typeIcon = '🔴 Gasto';
      if (theType === 'INCOME') typeIcon = '🟢 Ingreso';
      if (theType === 'TRANSFER') typeIcon = '🔄 Transferencia';

        let accountsInfoStr = "🏦 *Origen:* " + (originAcc?.name || extractedData.cuenta_origen || 'No detectado');
      if (theType === 'TRANSFER' || theType === 'INCOME') {
         accountsInfoStr += "\n🏦 *Destino:* " + (destAcc?.name || extractedData.cuenta_destino || 'No detectado');
      }

        let projectDisplay = matchedProject.name;
        if (theType === 'TRANSFER' && destAcc && destAcc.projectId) {
          const destProject = activeProjects.find((p: any) => p.id === destAcc.projectId);
          if (destProject && destProject.id !== matchedProject.id) {
            projectDisplay = `${matchedProject.name} ➡️ ${destProject.name}`;
          }
        }

        const amountLabel = fxTransfer
          ? `${fxTransfer.sourceAmount} ${fxTransfer.sourceCurrency} → ${fxTransfer.targetAmount} ${fxTransfer.targetCurrency}`
          : `${parsedAmount} ${finalCurrency}`;

        const formatResponse = "🤖 *Revisión de Transacción Inteligente*\n\n" +
          "💰 *Monto:* " + amountLabel + "\n" +
          "🗓️ *Fecha:* " + parsedDate.toISOString().replace('T', ' ').substring(0, 16) + "\n" +
          "📋 *Concepto:* " + extractedData.concepto + "\n" +
          "🏷️ *Categoría:* " + extractedData.categoria + "\n" +
          accountsInfoStr + "\n" +
          "🔃 *Tipo:* " + typeIcon + "\n" +
          "👨‍💻 *Proyecto:* " + projectDisplay + "\n" +
        "👤 *Contacto:* " + (matchedContact ? matchedContact.name : 'N/A') + "\n" +
        "💱 *Tasa " + (fxTransfer?.effectiveUsdToBs ? 'calculada' : 'referencial') + " (" + queryDate.toISOString().split('T')[0] + "):* " + (effectiveRate > 1 ? effectiveRate.toFixed(2) + ' Bs/USD' : 'N/A') + "\n\n" +
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
          const { _botFx, ...txDataToCreate } = txData;
          const newTx = await prisma.transaction.create({ 
            data: txDataToCreate,
            include: { entries: true } 
          });

          if (isTransfer) {
            // Auto-ejecutar el pago solo si es TRANSFERENCIA
            const payment = await prisma.payment.create({
              data: {
                project: { connect: { id: newTx.projectId } },
                code: "PAY-" + newTx.projectId.substring(0,6) + "-" + Date.now(),
                date: newTx.date,
                currency: _botFx?.sourceCurrency || newTx.currency,
                amount: _botFx?.sourceAmount || newTx.amount,
                targetCurrency: _botFx?.targetCurrency || null,
                exchangeRate: _botFx?.effectiveUsdToBs || null,
                method: 'BANK_TRANSFER',
                status: 'COMPLETED',
                user: { connect: { id: newTx.userId } },
                account: _botFx?.sourceAccountId ? { connect: { id: _botFx.sourceAccountId } } : undefined,
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
                const debitCurrency = _botFx?.destinationAccountId === entry.debitAccountId
                  ? _botFx.targetCurrency
                  : newTx.currency;
                await updateAccountBalance(entry.debitAccountId, debitCurrency, entry.debitAmount, 'DEBIT');
              }
              if (entry.creditAccountId && entry.creditAmount > 0) {
                const creditCurrency = _botFx?.sourceAccountId === entry.creditAccountId
                  ? _botFx.sourceCurrency
                  : newTx.currency;
                await updateAccountBalance(entry.creditAccountId, creditCurrency, entry.creditAmount, 'CREDIT');
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

