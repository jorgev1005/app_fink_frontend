const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log("Fixing CUSTOM rate with id 98666e7f-5a48-4a57-9c11-8aa8d499870e...");
  try {
    const updated = await prisma.exchangeRate.update({
      where: { id: "98666e7f-5a48-4a57-9c11-8aa8d499870e" },
      data: { 
        usdToBs: 413.39,
        eurToBs: 484.51
      } 
    });
    console.log("Fixed!", updated);
  } catch (e) {
    console.error("Error fixing:", e);
  }
}

fix().finally(() => prisma.$disconnect());
