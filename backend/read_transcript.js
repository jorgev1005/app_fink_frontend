const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = 'C:\\Users\\Jorge\\.gemini\\antigravity\\brain\\01cdc10c-c4a9-435f-bbd6-dc5e5e1ff31f\\.system_generated\\logs\\transcript.jsonl';
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const stepsOfInterest = [];

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      const stepIdx = Number(step.step_index);
      if (stepIdx >= 9430 && stepIdx <= 9580) {
        stepsOfInterest.push({
          step_index: stepIdx,
          type: step.type,
          source: step.source,
          content: step.content,
          tool_calls: step.tool_calls
        });
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`Found ${stepsOfInterest.length} steps in range 9430-9580`);
  stepsOfInterest.forEach(step => {
    console.log(`\n==========================================`);
    console.log(`Step ${step.step_index} | Type: ${step.type} | Source: ${step.source}`);
    if (step.content) {
      // Print first 500 chars of content
      console.log(`Content:\n${step.content.slice(0, 800)}`);
      if (step.content.length > 800) console.log("... [TRUNCATED]");
    }
    if (step.tool_calls && step.tool_calls.length > 0) {
      console.log(`Tool Calls:`, JSON.stringify(step.tool_calls, null, 2));
    }
  });
}

main().catch(console.error);
