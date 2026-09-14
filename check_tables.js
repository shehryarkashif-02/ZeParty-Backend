import prisma from './src/config/database.js';

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name ASC
  `;
  console.log(`TOTAL PUBLIC TABLES IN DB: ${tables.length}`);
  console.log('Tables:', tables.map(t => t.table_name).join(', '));
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
