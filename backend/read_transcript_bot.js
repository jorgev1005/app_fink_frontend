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
  let index = 0;

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      const content = step.content || '';
      if (
        step.type === 'USER_INPUT' || 
        step.type === 'PLANNER_RESPONSE'
      ) {
        if (
          content.toLowerCase().includes('bot') || 
          content.toLowerCase().includes('whatsapp') || 
          content.toLowerCase().includes('crm')
        ) {
          matches.push({
            step_index: step.step_index,
            source: step.source,
            type: step.type,
            content: content
          });
        }
      }
    } catch (e) {
      // ignore
    }
    index++;
  }

  console.log(`Found ${matches.length} matching steps.`);
  
  // Show key summary messages from history
  console.log("\n=== KEY TRANSCRIPT STEPS CONTAINING 'BOT' / 'WHATSAPP' / 'CRM' ===");
  // Print some samples from different parts of the conversation to get the timeline
  const count = matches.length;
  matches.forEach((msg, i) => {
    // Print first 5 and last 10
    if (i < 5 || i >= count - 15) {
      console.log(`\n------------------------------------------`);
      console.log(`Step ${msg.step_index} | Source: ${msg.source} | Type: ${msg.type}`);
      console.log(`Content:\n${msg.content.slice(0, 500)}`);
      if (msg.content.length > 500) console.log("... [TRUNCATED]");
    } else if (i === 5) {
      console.log(`\n... [SKIPPED ${count - 20} MATCHES] ...`);
    }
  });
}

main().catch(console.error);
