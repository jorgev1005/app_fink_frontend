import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeName(raw: string) {
  const s = (raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--yes') || args.includes('-y');

  console.log('🔎 Leyendo categorías libres desde transactions.category');
  const rows = await prisma.transaction.findMany({
    where: { category: { not: null } },
    distinct: ['category'],
    select: { category: true },
  });

  const distinct = rows.map(r => r.category).filter(Boolean) as string[];
  const mapping: Record<string, string> = {};

  for (const raw of distinct) {
    const name = normalizeName(raw as string);
    mapping[raw as string] = name;
  }

  const uniqueNames = Array.from(new Set(Object.values(mapping))).filter(Boolean);

  console.log(`Found ${distinct.length} legacy category values -> ${uniqueNames.length} normalized names.`);
  console.log('Sample mapping (first 20):');
  Object.entries(mapping).slice(0, 20).forEach(([k, v]) => console.log(`  '${k}' -> '${v}'`));

  if (!doApply) {
    console.log('\nDry run complete. To apply changes run with --yes flag.');
    process.exit(0);
  }

  console.log('\nAplicando cambios: creando categorías normalizadas y actualizando transacciones...');
  await prisma.$transaction(async (tx) => {
    const createdMap: Record<string, string> = {};

    for (const name of uniqueNames) {
      // find or create (use any to avoid TS generator type issues in scripts)
      let cat = await (tx as any).transactionCategory.findUnique({ where: { name } });
      if (!cat) {
        cat = await (tx as any).transactionCategory.create({ data: { name } });
      }
      createdMap[name] = cat.id;
    }

    // Update transactions in batches
    for (const [raw, normalized] of Object.entries(mapping)) {
      const categoryId = createdMap[normalized];
      if (!categoryId) continue;
      const res = await (tx as any).transaction.updateMany({ where: { category: raw }, data: { categoryId } });
      console.log(`Updated ${res.count} transactions for '${raw}' -> '${normalized}'`);
    }
  });

  console.log('✅ Normalización completa.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
