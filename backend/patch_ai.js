const fs = require('fs');

let code = fs.readFileSync('src/services/ai.service.ts', 'utf8');

const search = "  const response = await fetch('https://openrouter.ai/api/v1/chat/completions'";
const index = code.indexOf(search);
if (index === -1) { console.error('NOT FOUND 1'); process.exit(1); }

const endSearch = "throw new Error('Error en OpenRouter: ' + err);";
const endIndex = code.indexOf(endSearch, index);
const realEnd = code.indexOf('}', endIndex) + 1;
const toReplace = code.substring(index, realEnd);

const replacement = `  let response;
  let attempts = 0;
  while (attempts < 3) {
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${OPENROUTER_API_KEY}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Debes responder SOLO con un OBJETO JSON válido sin formato ni backticks.' },
            { role: 'user', content: prompt }
          ]
        }),
        signal: AbortSignal.timeout(15000)
      });
      break;
    } catch (e) {
      attempts++;
      console.log('AI Timeout, retrying', attempts);
      if (attempts >= 3) {
          throw new Error("terminated"); // This mimics what telegram throws, or we can throw custom
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!response || !response.ok) {
    const err = response ? await response.text() : 'Network Timeout';
    throw new Error('Error en OpenRouter: ' + err);
  }`;

fs.writeFileSync('src/services/ai.service.ts', code.replace(toReplace, replacement));
console.log('AI Patch OK!');
