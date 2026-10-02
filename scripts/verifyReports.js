/**
 * Cross-check the report endpoints against direct SQL.
 *
 * The reports run through the Prisma collection adapter; this computes the
 * same figures with hand-written SQL so a discrepancy in either direction is
 * visible. Both must be the same number.
 *
 * Run: node scripts/verifyReports.js
 */
const { prisma } = require("../src/config/prisma");
const connectDB = require("../src/config/db");
const { ReportService } = require("../src/modules/reports/service");

const results = [];
const check = (name, apiValue, sqlValue, extra = "") => {
  const same = Number(apiValue) === Number(sqlValue);
  results.push({ name, same, apiValue, sqlValue });
  console.log(
    `  ${same ? "MATCH" : "DIFF "}  ${name.padEnd(34)} api=${String(apiValue).padStart(14)}  sql=${String(sqlValue).padStart(14)}  ${extra}`
  );
};

async function main() {
  await connectDB();
  const range = { startDate: "2020-01-01", endDate: "2030-12-31" };

  console.log("\n1. Collection report vs SQL");
  const collection = await ReportService.collection({ ...range, interval: "monthly" });
  const [sqlTotal] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total
    FROM payments
    WHERE status = 'Completed' AND "createdAt" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("collection total", collection.total, sqlTotal.total, `rows=${collection.data.length}`);

  const apiCount = collection.data.reduce((s, r) => s + r.count, 0);
  const [sqlCount] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM payments
    WHERE status = 'Completed' AND "createdAt" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("collection payment count", apiCount, sqlCount.n);

  console.log("\n2. Dues report vs SQL");
  const dues = await ReportService.dues(range);
  const [sqlDues] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(balance), 0)::float8 AS total
    FROM installments
    WHERE balance > 0 AND "dueDate" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("dues total", dues.total, sqlDues.total, `rows=${dues.data.length}`);

  const apiDueCount = dues.data.reduce((s, r) => s + r.count, 0);
  const [sqlDueCount] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM installments
    WHERE balance > 0 AND "dueDate" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("dues installment count", apiDueCount, sqlDueCount.n);

  console.log("\n3. Defaulters report vs SQL");
  const defaulters = await ReportService.defaulters(range);
  const [sqlDef] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(balance), 0)::float8 AS total
    FROM installments
    WHERE balance > 0
      AND "dueDate" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
      AND "dueDate" < NOW()
  `;
  check("defaulters total", defaulters.total, sqlDef.total, `rows=${defaulters.data.length}`);

  const apiDefCount = defaulters.data.reduce((s, r) => s + r.installments, 0);
  const [sqlDefCount] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM installments
    WHERE balance > 0
      AND "dueDate" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
      AND "dueDate" < NOW()
  `;
  check("defaulter installment count", apiDefCount, sqlDefCount.n);

  console.log("\n4. Income/expense report vs SQL");
  const ie = await ReportService.incomeExpense({ ...range, interval: "monthly" });
  const [sqlIncome] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM payments
    WHERE status = 'Completed' AND "createdAt" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  const [sqlExpense] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM expenses
    WHERE status = 'Paid' AND date BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("income total", ie.totals.income, sqlIncome.total);
  check("expense total", ie.totals.expense, sqlExpense.total);

  console.log("\n5. Refunds report vs SQL");
  const refunds = await ReportService.refunds(range);
  const [sqlRefunds] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM refunds
    WHERE "createdAt" BETWEEN ${range.startDate}::timestamptz AND ${range.endDate}::timestamptz
  `;
  check("refunds total", refunds.total, sqlRefunds.total, `rows=${refunds.data.length}`);

  console.log("\n6. Response shape preserved (regression guard)");
  const shape = JSON.stringify(Object.keys(collection).sort());
  check("collection keys", shape === JSON.stringify(["data", "interval", "range", "report", "total"]), true, shape);

  const diffs = results.filter((r) => !r.same);
  console.log(`\n${"=".repeat(78)}`);
  console.log(`  comparisons: ${results.length}   matched: ${results.length - diffs.length}   differing: ${diffs.length}`);
  console.log(`${"=".repeat(78)}\n`);
  if (diffs.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Report verification crashed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
