
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const invoices = await prisma.invoice.findMany({
        take: 5,
        orderBy: { issueDate: 'desc' },
        include: {
            project: true
        }
    });

    console.log('--- Invoices ---');
    for (const inv of invoices) {
        let tax = 0;
        try {
            if (inv.lines) {
                const l = JSON.parse(inv.lines);
                tax = l.taxAmount;
            }
        } catch(e) {}
        console.log(`Code: ${inv.code}`);
        console.log(`Total: ${inv.total}`);
        console.log(`Outstanding: ${inv.outstanding}`);
        console.log(`Lines: ${inv.lines}`);
        console.log(`Extracted Tax: ${tax}`);
        console.log(`Calc Base: ${inv.total - tax}`);
        console.log('------------------');
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
