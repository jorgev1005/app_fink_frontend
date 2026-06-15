const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = 'C:\\Users\\Jorge\\.gemini\\antigravity\\brain\\01cdc10c-c4a9-435f-bbd6-dc5e5e1ff31f\\.system_generated\\logs\\transcript.jsonl';
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const matches = [];

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      if (step.type === 'USER_INPUT') {
        const text = step.content || '';
        if (
          text.toLowerCase().includes('pendiente') || 
          text.toLowerCase().includes('whatsapp') || 
          text.toLowerCase().includes('bot') ||
          text.toLowerCase().includes('crm')
        ) {
          matches.push({
            step_index: step.step_index,
            content: text
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`Found ${matches.length} matching user requests.`);
  matches.forEach(m => {
    console.log(`\n==========================================`);
    console.log(`[Step ${m.step_index}]`);
    console.log(m.content);
  });
}

main().catch(console.error);
