const fs = require('fs');

async function updateSchema() {
  let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

  // Reverse relations
  if (!s.includes('loans                   Loan[]')) {
    s = s.replace(/model Project \{[^}]*users\s+ProjectUser\[\]/m, match => match + '\n  loans                   Loan[]');
  }
  if (!s.includes('loansAsLiability')) {
    s = s.replace(/model Account \{[^}]*paymentSources\s+Payment\[\]\s+@relation\("PaymentSourceAccount"\)/m, match => match + '\n  loansAsLiability        Loan[]                      @relation("LoanLiabilityAccount")');
  }
  if (!s.includes('  loans                   Loan[]') && s.includes('model ContactPerson {')) {
    s = s.replace(/model ContactPerson \{[^}]*project\s+Project\s+@relation\(fields:\s+\[projectId\],\s+references:\s+\[id\],\s+onDelete:\s+Cascade\)/m, match => match + '\n  loans                   Loan[]');
  }
  if (!s.includes('loanPayments LoanPayment[]')) {
    s = s.replace(/model Transaction \{[^}]*project\s+Project\s+@relation\(fields:\s+\[projectId\],\s+references:\s+\[id\],\s+onDelete:\s+Cascade\)/m, match => match + '\n  loanPayments LoanPayment[]');
  }
  if (!s.includes('loanCharges     LoanCharge[]')) {
    s = s.replace(/model Invoice \{[^}]*project\s+Project\s+@relation\(fields:\s+\[projectId\],\s+references:\s+\[id\],\s+onDelete:\s+Cascade\)/m, match => match + '\n  loanCharges     LoanCharge[]');
  }

  const newModels = `
// ==========================================
// MODULO DE PRESTAMOS E INVERSIONES
// ==========================================

model Loan {
  id              String   @id @default(uuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id])
  
  contactId       String?
  contact         ContactPerson? @relation(fields: [contactId], references: [id])

  name            String   // Ejemplo: "Préstamo rápido José"
  type            String   @default("INFORMAL") // INFORMAL, BANK
  
  // Condición financiera
  currency        String   @default("USD")
  principalAmount Float    // Monto inicial prestado
  remainingCapital Float   // Lo que falta por pagar de capital
  
  interestRate    Float    // Ejemplo: 10.0 (para 10%)
  interestType    String   @default("FIXED_ON_BALANCE") // FIXED_ON_BALANCE (sobre saldo deudor)
  interestFrequency String @default("WEEKLY") // WEEKLY, BIWEEKLY, MONTHLY
  nextChargeDate  DateTime? // Cuándo toca calcular el próximo interés 

  startDate       DateTime @default(now())
  status          String   @default("ACTIVE") // ACTIVE, PAID, DEFAULTED

  // Contabilidad
  linkedAccountId String?  // La cuenta de PASIVO que representa esta deuda contablemente
  linkedAccount   Account? @relation("LoanLiabilityAccount", fields: [linkedAccountId], references: [id])

  charges         LoanCharge[]
  payments        LoanPayment[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model LoanCharge {
  id          String   @id @default(uuid())
  loanId      String
  loan        Loan     @relation(fields: [loanId], references: [id], onDelete: Cascade)
  
  date        DateTime @default(now())
  amount      Float    // Monto de interés generado
  description String?  // Ej: "Interés semanal 10% sobre capital de 300"
  status      String   @default("UNPAID") // UNPAID, PAID, PARTIAL
  paidAmount  Float    @default(0) // Cuánto de este cargo se ha pagado
  
  // Opcionalmente podemos ligarlo a un gasto / cxp
  invoiceId   String?  
  invoice     Invoice? @relation(fields: [invoiceId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model LoanPayment {
  id          String   @id @default(uuid())
  loanId      String
  loan        Loan     @relation(fields: [loanId], references: [id], onDelete: Cascade)

  date        DateTime @default(now())
  
  // Desglose del pago
  totalAmount     Float 
  principalAmount Float 
  interestAmount  Float 

  // Contabilidad del pago
  transactionId String?
  transaction   Transaction? @relation(fields: [transactionId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
`;

  if (!s.includes('model Loan {')) {
    fs.writeFileSync('prisma/schema.prisma', s + newModels);
    console.log('Modelos insertados en schema.prisma.');
  } else {
    console.log('Los modelos ya existían.');
  }
}

updateSchema();
