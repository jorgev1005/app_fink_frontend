const fs = require('fs');
const filepath = 'backend/src/services/telegram.service.ts';
let content = fs.readFileSync(filepath, 'utf8');

const target1 = `const newTx = await prisma.transaction.create({ 
            data: txData,
            include: { entries: true } 
          });`;

const replacement1 = `console.log("SENDING TO PRISMA:", JSON.stringify(txData, null, 2));
          const newTx = await prisma.transaction.create({ 
            data: txData,
            include: { entries: true } 
          });`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement1);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log("Patched with debug log!");
} else {
    console.log("NOT FOUND!");
}
