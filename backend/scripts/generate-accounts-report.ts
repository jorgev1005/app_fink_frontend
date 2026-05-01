#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';

const outDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const fileName = `accounts_balances_report_${timestamp}.csv`;
const latestName = `accounts_balances_report_latest.csv`;
const outPath = path.join(outDir, fileName);
const latestPath = path.join(outDir, latestName);

const headers = ['accountId','code','name','projectId','projectCode','projectName','balanceBs','balanceUsd','balanceEur','updatedAt'];

async function main() {
  const accounts = await prisma.account.findMany({
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: [{ projectId: 'asc' }, { code: 'asc' }]
  });

  const rows = accounts.map(a => {
    const project = a.project || { id: '', code: '', name: '' };
    return [
      a.id,
      a.code,
      a.name.replace(/\r?\n/g, ' '),
      project.id || '',
      project.code || '',
      project.name || '',
      String(a.balanceBs),
      String(a.balanceUsd),
      String(a.balanceEur),
      a.updatedAt.toISOString()
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const content = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(outPath, content, 'utf8');
  fs.writeFileSync(latestPath, content, 'utf8');

  console.log(`Report written to: ${outPath}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error generating report:', e);
  await prisma.$disconnect();
  process.exit(1);
});
