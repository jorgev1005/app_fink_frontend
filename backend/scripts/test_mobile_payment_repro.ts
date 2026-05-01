
import prisma from '../src/config/database';
import { PaymentService } from '../src/services/payment.service';

async function main() {
    try {
        console.log("Starting Mobile Payment Test...");

        // 1. Find a Project
        const project = await prisma.project.findFirst();
        if(!project) throw new Error("No project found");
        console.log("Project:", project.name);

        // 2. Find a User
        const user = await prisma.user.findFirst();
        if(!user) throw new Error("No user found");
        console.log("User:", user.email);

        // 3. Find an Account (Bank/Cash)
        const account = await prisma.account.findFirst({
            where: { projectId: project.id }
        });
        if(!account) throw new Error("No account found");
        console.log("Account:", account.name);

        // 4. Find/Create a dummy Invoice
        let invoice = await prisma.invoice.findFirst({
            where: { projectId: project.id, status: 'OPEN' }
        });
        
        if (!invoice) {
             invoice = await prisma.invoice.create({
                 data: {
                     projectId: project.id,
                     code: 'TEST-INV-' + Date.now(),
                     issueDate: new Date(),
                     dueDate: new Date(),
                     total: 100,
                     outstanding: 100,
                     currency: 'USD',
                     type: 'BILL',
                     createdBy: user.id
                 }
             });
             console.log("Created Test Invoice:", invoice.code);
        } else {
             console.log("Using Invoice:", invoice.code);
        }

        // 5. Attempt Payment with 'MOBILE_PAYMENT'
        console.log("Attempting Payment creation...");
        const payment = await PaymentService.createPayment({
            projectId: project.id,
            userId: user.id,
            date: new Date(),
            amount: 10,
            currency: 'USD',
            accountId: account.id,
            method: 'MOBILE_PAYMENT',
            reference: '123456',
            allocations: [{ invoiceId: invoice.id, amount: 10 }],
            targetCurrency: 'USD',
            exchangeRate: 1
        });

        console.log("SUCCESS! Payment Created:", payment.id);
        console.log("Stored Method:", payment.method);

    } catch (e: any) {
        console.error("FAILURE:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
