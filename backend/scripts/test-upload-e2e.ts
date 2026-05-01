import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import attachmentsService from '../src/services/attachments.service';

const prisma = new PrismaClient();

async function main() {
  // Find a project and user to attach to
  const project = await prisma.project.findFirst();
  const user = await prisma.user.findFirst();

  if (!project || !user) {
    console.error('No hay project o user en la DB. Crea al menos uno.');
    process.exit(1);
  }

  // Create a minimal transaction in DRAFT so we can attach files
  const tx = await prisma.transaction.create({
    data: {
      code: `E2E-${Date.now()}`,
      type: 'EXPENSE',
      description: 'E2E test transaction',
      currency: 'USD',
      amount: 1.23,
      amountBs: 0,
      amountUsd: 1.23,
      amountEur: 0,
      status: 'COMPLETED',
      project: { connect: { id: project.id } },
      user: { connect: { id: user.id } },
      entries: { create: [] },
    },
  });

  console.log('Created test transaction:', tx.id);

  // Prepare sample file by copying into uploads/transactions/<txid>/
  const destDir = path.join(__dirname, '..', 'uploads', 'transactions', tx.id);
  fs.mkdirSync(destDir, { recursive: true });

  // Create a small, valid one-page PDF (text-based) to ensure pdftoppm can render it
  const filename = `${Date.now()}-sample.pdf`;
  const destPath = path.join(destDir, filename);

  // If a real sample PDF exists in scripts/test-files/sample-real.pdf, use it (preferred)
  const sampleSrc = path.join(__dirname, 'test-files', 'sample-real.pdf');
  if (fs.existsSync(sampleSrc)) {
    fs.copyFileSync(sampleSrc, destPath);
  } else {
    const pdfContent = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R>> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 24 Tf 50 150 Td (Hello PDF) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000061 00000 n 
0000000110 00000 n 
0000000200 00000 n 
0000000260 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
320
%%EOF`;

    fs.writeFileSync(destPath, pdfContent, 'binary');
  }

  // Create Express.Multer.File-like object for the generated PDF
  const fileObj: any = {
    fieldname: 'files',
    originalname: 'sample.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    destination: destDir,
    filename: filename,
    path: destPath,
    size: fs.statSync(destPath).size,
  };

  console.log('Uploading file via service...');
  const result = await attachmentsService.processAttachments(tx.id, [fileObj], user.id);

  console.log('Upload result:', result.uploaded);
  console.log('AI data snippet:', result.ai);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
