const fs = require('fs');
const file = 'src/services/telegram.service.ts';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
  "const bot = new TelegramBot(token, { polling: true });\r\n  console.log('🤖 Bot de Telegram inicializado y escuchando...');",
  "const bot = new TelegramBot(token, { polling: true });\n  bot.on('polling_error', (err) => console.log('Telegram Polling warning:', err.message));\n  console.log('🤖 Bot de Telegram inicializado y escuchando...');"
);

code = code.replace(
  "const bot = new TelegramBot(token, { polling: true });\n  console.log('🤖 Bot de Telegram inicializado y escuchando...');",
  "const bot = new TelegramBot(token, { polling: true });\n  bot.on('polling_error', (err) => console.log('Telegram Polling warning:', err.message));\n  console.log('🤖 Bot de Telegram inicializado y escuchando...');"
);

fs.writeFileSync(file, code);
console.log('Done');
