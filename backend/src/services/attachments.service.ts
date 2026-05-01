import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
const pdfParse: any = require('pdf-parse');
const { createWorker } = require('tesseract.js');
import { exec } from 'child_process';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

const USE_S3 = process.env.USE_S3 === 'true';
let s3: S3Client | null = null;
if (USE_S3) s3 = new S3Client({ region: process.env.AWS_REGION });

async function scanWithClam(filePath: string): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    // Try clamscan then clamdscan
    exec(`clamscan "${filePath}"`, (err, stdout) => {
      if (err) {
        // clamscan not available or error; skip scan
        return resolve({ ok: true });
      }
      const out = stdout || '';
      if (out.includes('OK')) return resolve({ ok: true });
      if (out.includes('FOUND')) return resolve({ ok: false, reason: out });
      return resolve({ ok: true });
    });
  });
}

async function extractTextFromPdf(filePath: string) {
  try {
    const data = fs.readFileSync(filePath);
    const result: any = await pdfParse(data);
    return result.text || '';
  } catch (e) {
    return '';
  }
}

async function extractTextFromImage(filePath: string) {
  try {
  const worker: any = createWorker();
  await worker.load();
  await worker.loadLanguage('spa');
  await worker.initialize('spa');
  const { data: { text } } = await worker.recognize(filePath);
  await worker.terminate();
  return text || '';
  } catch (e) {
    // fallback to english
    try {
      const worker: any = createWorker();
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(filePath);
      await worker.terminate();
      return text || '';
    } catch (err) {
      return '';
    }
  }
}

function tryExtractMetadata(rawText: string) {
  const text = rawText.replace(/\s+/g, ' ');
  const invoiceMatch = text.match(/(?:factura\s*#?\s*|invoice\s*#?\s*)([A-Za-z0-9\-\./]+)/i);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}\.\d{2}\.\d{4})/);
  const amountMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
  return {
    invoiceNumber: invoiceMatch ? invoiceMatch[1] : null,
    date: dateMatch ? dateMatch[1] : null,
    amount: amountMatch ? amountMatch[1] : null,
  };
}

export async function processAttachments(transactionId: string, files: Express.Multer.File[], userId: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new Error('Transaction not found');

  const port = process.env.PORT || 4001;
  const host = process.env.PUBLIC_API_URL || `http://localhost:${port}`;

  const uploadedUrls: string[] = [];
  const aiData: any[] = [];

  for (const f of files) {
    // Antivirus scan
    const scan = await scanWithClam(f.path);
    if (!scan.ok) {
      // delete file
      try { fs.unlinkSync(f.path); } catch (e) {}
      throw new Error('Virus detected: ' + (scan.reason || ''));
    }

    // Upload to S3 or keep local
    if (USE_S3 && s3) {
      const bucket = process.env.AWS_S3_BUCKET as string;
      const key = `transactions/${transactionId}/${f.filename}`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(f.path), ContentType: f.mimetype }));
      uploadedUrls.push(`https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`);
      try { fs.unlinkSync(f.path); } catch (e) {}
    } else {
      uploadedUrls.push(`${host}/uploads/transactions/${transactionId}/${f.filename}`);
    }

    // Thumbnail for images
    if (f.mimetype.startsWith('image/')) {
      try {
        const thumbDir = path.join(__dirname, '../../uploads/transactions', transactionId, 'thumbs');
        fs.mkdirSync(thumbDir, { recursive: true });
        const thumbPath = path.join(thumbDir, `thumb-${f.filename}`);
        await sharp(f.path).resize({ width: 400 }).toFile(thumbPath);
        // if S3, upload thumb
        if (USE_S3 && s3) {
          const bucket = process.env.AWS_S3_BUCKET as string;
          const key = `transactions/${transactionId}/thumbs/thumb-${f.filename}`;
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(thumbPath), ContentType: 'image/png' }));
          try { fs.unlinkSync(thumbPath); } catch (e) {}
        }
      } catch (e) {
        console.warn('Thumbnail generation failed', e);
      }
    }

    // Thumbnail for PDFs (generate PNG of first page using pdftoppm if available)
    if (f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const thumbDir = path.join(__dirname, '../../uploads/transactions', transactionId, 'thumbs');
        fs.mkdirSync(thumbDir, { recursive: true });
        const outPrefix = path.join(thumbDir, `pdfthumb-${f.filename.replace(/\.pdf$/i, '')}`);
        // Try to run pdftoppm (part of poppler-utils). Allow overriding via PDFTOPPM_BIN env var
        const pdftoppmBin = process.env.PDFTOPPM_BIN || 'pdftoppm';
        await new Promise<void>((resolve, reject) => {
          const cmd = `"${pdftoppmBin}" -png -f 1 -singlefile "${f.path}" "${outPrefix}"`;
          exec(cmd, (err, stdout, stderr) => {
            if (err) {
              // pdftoppm not available or failed
              return reject(err);
            }
            return resolve();
          });
        }).catch((err) => {
          // don't fail the whole process if thumbnail generation fails
          console.warn('PDF thumbnail generation failed or pdftoppm not found:', err && err.message ? err.message : err);
        });

        const generatedPng = `${outPrefix}.png`;
        if (fs.existsSync(generatedPng)) {
          // Resize/normalize
          const finalThumb = path.join(thumbDir, `thumb-${f.filename}.png`);
          await sharp(generatedPng).resize({ width: 400 }).png().toFile(finalThumb);
          // cleanup intermediate
          try { fs.unlinkSync(generatedPng); } catch (e) {}

          if (USE_S3 && s3) {
            const bucket = process.env.AWS_S3_BUCKET as string;
            const key = `transactions/${transactionId}/thumbs/thumb-${f.filename}.png`;
            await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.createReadStream(finalThumb), ContentType: 'image/png' }));
            try { fs.unlinkSync(finalThumb); } catch (e) {}
          }
        }
      } catch (e) {
        // pdftoppm not available or generation failed; skip
        // console.warn('PDF thumbnail generation skipped or failed', e);
      }
    }

    // OCR / PDF text extraction
    let rawText = '';
    try {
      if (f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf')) {
        rawText = await extractTextFromPdf(f.path);
      } else if (f.mimetype.startsWith('image/')) {
        rawText = await extractTextFromImage(f.path);
      } else {
        // attempt to read text for txt/csv
        try { rawText = fs.readFileSync(f.path, 'utf8'); } catch (e) { rawText = ''; }
      }
    } catch (e) {
      rawText = '';
    }

    const meta = tryExtractMetadata(rawText);
    aiData.push({ file: f.filename, textSnippet: rawText.slice(0, 1000), meta });
  }

  // Save attachments to transaction
  const existing = transaction.attachments ? JSON.parse(transaction.attachments) : [];
  const updated = [...existing, ...uploadedUrls];
  const updatedTxn = await prisma.transaction.update({ where: { id: transactionId }, data: { attachments: JSON.stringify(updated) } });

  // create Document minimal
  try {
    const docCode = `DOC-${transaction.code}-${Date.now()}`;
    await prisma.document.create({
      data: {
        code: docCode,
        type: 'OTHER',
        status: 'PENDING',
        title: `Adjuntos ${transaction.code}`,
        description: 'Archivos subidos',
        currency: transaction.currency,
        amount: 0,
        issueDate: new Date(),
        project: { connect: { id: transaction.projectId } },
        transaction: { connect: { id: transactionId } },
        files: JSON.stringify(uploadedUrls),
        aiExtractedData: JSON.stringify(aiData),
        aiConfidence: 0.5,
        tags: '[]',
        user: { connect: { id: userId } },
      },
    });
  } catch (e) {
    console.warn('Could not create Document record', e);
  }

  return { uploaded: uploadedUrls, ai: aiData, transaction: updatedTxn };
}

export async function deleteAttachmentInternal(transactionId: string, filename: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction) throw new Error('Transaction not found');
  const attachments = transaction.attachments ? JSON.parse(transaction.attachments) : [];
  const updated = attachments.filter((a: string) => !a.endsWith(`/${filename}`));

  if (USE_S3 && s3) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET as string, Key: `transactions/${transactionId}/${filename}` })); } catch (e) {}
    try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET as string, Key: `transactions/${transactionId}/thumbs/thumb-${filename}` })); } catch (e) {}
  } else {
    const filePath = path.join(__dirname, '../../uploads/transactions', transactionId, filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
    const thumbPath = path.join(__dirname, '../../uploads/transactions', transactionId, 'thumbs', `thumb-${filename}`);
    try { if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (e) {}
  }

  const updatedTxn = await prisma.transaction.update({ where: { id: transactionId }, data: { attachments: updated } });
  return updatedTxn;
}

export default { processAttachments, deleteAttachmentInternal };
