const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contactPerson.findMany();
  console.log("CONTACTS:");
  console.log(contacts.map(c => c.name));

  const invoices = await prisma.invoice.findMany();
  console.log("INVOICE DESCRIPTIONS (from lines JSON):");
  console.log(invoices.map(i => {
    let desc = "no lines";
    try {
       const ls = JSON.parse(i.lines || "[]");
       desc = ls.map(l => l.description).join(", ");
    } catch(e){}
    return { code: i.code, type: i.type, desc: desc, status: i.status };
  }));

  const rules = await prisma.recurringRule.findMany();
  console.log("RULES:");
  console.log(rules.map(r => ({ id: r.id, desc: r.description, status: r.status, type: r.type })));

}
main().finally(() => prisma.$disconnect());