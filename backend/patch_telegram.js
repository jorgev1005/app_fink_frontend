const fs = require('fs');

let code = fs.readFileSync('src/services/telegram.service.ts', 'utf8');

const search = "        const waitMsg = await bot.sendMessage(chatId, '🎙️ Escuchando...');";
const index = code.indexOf(search);
if (index === -1) { console.error('NOT FOUND 1'); process.exit(1); }

const endSearch = "const audioBuffer = Buffer.from(audioResponse.data);";
const endIndex = code.indexOf(endSearch, index);
const toReplace = code.substring(index, endIndex + endSearch.length);

const replacement = `        const waitMsg = await bot.sendMessage(chatId, '🎙️ Escuchando...');
        
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
        }`;

fs.writeFileSync('src/services/telegram.service.ts', code.replace(toReplace, replacement));
console.log('Telegram Patch OK!');
