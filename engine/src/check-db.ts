import { prisma } from '@lotsy/db';

const count = await prisma.deal.count();
const sample = await prisma.deal.findMany({ take: 3, orderBy: { totalPrice: 'asc' } });
const run = await prisma.searchRun.findFirst({ orderBy: { startedAt: 'desc' } });

console.log('Deals in DB:', count);
sample.forEach((d) =>
  console.log(
    `  ${d.originAirport}->${d.destAirport} ${d.departAt.toISOString().slice(0, 10)} ${d.nights}n ${d.totalPrice.toFixed(0)} PLN`,
  ),
);
console.log('Last run:', run?.status, 'deals:', run?.dealsFound, 'routes:', run?.routesQueried);

await prisma.$disconnect();
