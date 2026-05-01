#!/usr/bin/env ts-node
import prisma from '../src/config/database';

type Args = {
  zeroAccounts?: boolean;
  archiveProjects?: string[];
  startAllProjects?: boolean;
  resetProjectCapitals?: boolean;
  confirm?: boolean;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  const res: Args = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--zero-accounts') res.zeroAccounts = true;
    else if (a === '--archive-projects') {
      const val = args[i + 1];
      if (val) {
        res.archiveProjects = val.split(',').map(s => s.trim()).filter(Boolean);
        i++;
      }
    } else if (a === '--start-all-projects') res.startAllProjects = true;
    else if (a === '--reset-project-capitals') res.resetProjectCapitals = true;
    else if (a === '--confirm') res.confirm = true;
  }
  return res;
};

const zeroAccounts = async () => {
  console.log('Zeroing balances for all accounts...');
  const r = await prisma.account.updateMany({ data: { balanceBs: 0, balanceUsd: 0, balanceEur: 0 } });
  console.log(`Updated ${r.count} accounts.`);
};

const archiveProjects = async (names: string[]) => {
  for (const name of names) {
    const proj = await prisma.project.findFirst({ where: { name } });
    if (!proj) {
      console.log(`Project not found: ${name}`);
      continue;
    }
    await prisma.project.update({ where: { id: proj.id }, data: { status: 'ARCHIVED' } as any });
    console.log(`Archived project: ${name} (id=${proj.id})`);
  }
};

const startAllProjects = async () => {
  console.log('Setting status ACTIVE for all projects...');
  const projects = await prisma.project.findMany();
  for (const p of projects) {
    await prisma.project.update({ where: { id: p.id }, data: { status: 'ACTIVE' } as any });
  }
  console.log(`Updated ${projects.length} projects to ACTIVE.`);
};

const resetProjectCapitals = async () => {
  console.log('Resetting initial capital fields for all projects to 0...');
  const projects = await prisma.project.findMany();
  for (const p of projects) {
    await prisma.project.update({ where: { id: p.id }, data: { initialCapitalBs: 0, initialCapitalUsd: 0, initialCapitalEur: 0 } as any });
  }
  console.log(`Reset initial capital for ${projects.length} projects.`);
};

const main = async () => {
  const args = parseArgs();

  if (!args.zeroAccounts && !args.archiveProjects && !args.startAllProjects && !args.resetProjectCapitals) {
    console.log('Usage: ts-node scripts/maintenance.ts [--zero-accounts] [--archive-projects "Name1,Name2"] [--start-all-projects] [--reset-project-capitals] --confirm');
    process.exit(0);
  }

  console.log('Maintenance script - planned actions:');
  if (args.zeroAccounts) console.log('- Zero balances for all accounts');
  if (args.archiveProjects && args.archiveProjects.length) console.log(`- Archive projects: ${args.archiveProjects.join(', ')}`);
  if (args.startAllProjects) console.log('- Set all projects to ACTIVE');
  if (args.resetProjectCapitals) console.log('- Reset initial capital fields for all projects to 0');

  if (!args.confirm) {
    console.log('\nDRY RUN: add --confirm to actually perform the operations');
    await prisma.$disconnect();
    process.exit(0);
  }

  try {
    if (args.zeroAccounts) await zeroAccounts();
    if (args.archiveProjects && args.archiveProjects.length) await archiveProjects(args.archiveProjects);
    if (args.startAllProjects) await startAllProjects();
    if (args.resetProjectCapitals) await resetProjectCapitals();
    console.log('Maintenance actions completed.');
  } catch (e) {
    console.error('Error during maintenance:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

main();
