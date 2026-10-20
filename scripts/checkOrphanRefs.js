/**
 * Read-only orphan reference report (P5-2).
 *
 * Reports rows whose string FK-like columns point at missing parents.
 * Does not modify data. Exit code 1 if any orphans are found.
 *
 *   node scripts/checkOrphanRefs.js
 */
const { prisma } = require("../src/config/prisma");

const CHECKS = [
  {
    name: "Booking.member → Member",
    sql: `
      SELECT b.id AS child_id, b.member AS ref_id
      FROM bookings b
      LEFT JOIN members m ON m.id = b.member
      WHERE b.member IS NOT NULL AND b.member <> '' AND m.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "Booking.plot → Plot",
    sql: `
      SELECT b.id AS child_id, b.plot AS ref_id
      FROM bookings b
      LEFT JOIN plots p ON p.id = b.plot
      WHERE b.plot IS NOT NULL AND b.plot <> '' AND p.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "Payment.member → Member",
    sql: `
      SELECT p.id AS child_id, p.member AS ref_id
      FROM payments p
      LEFT JOIN members m ON m.id = p.member
      WHERE p.member IS NOT NULL AND p.member <> '' AND m.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "Installment.member → Member",
    sql: `
      SELECT i.id AS child_id, i.member AS ref_id
      FROM installments i
      LEFT JOIN members m ON m.id = i.member
      WHERE i.member IS NOT NULL AND i.member <> '' AND m.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "Installment.plan → InstallmentPlan",
    sql: `
      SELECT i.id AS child_id, i.plan AS ref_id
      FROM installments i
      LEFT JOIN installment_plans pl ON pl.id = i.plan
      WHERE i.plan IS NOT NULL AND i.plan <> '' AND pl.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "Plot.currentOwner → Member",
    sql: `
      SELECT p.id AS child_id, p."currentOwner" AS ref_id
      FROM plots p
      LEFT JOIN members m ON m.id = p."currentOwner"
      WHERE p."currentOwner" IS NOT NULL AND p."currentOwner" <> '' AND m.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "OwnershipHistory.plot → Plot",
    sql: `
      SELECT o.id AS child_id, o.plot AS ref_id
      FROM ownership_history o
      LEFT JOIN plots p ON p.id = o.plot
      WHERE o.plot IS NOT NULL AND o.plot <> '' AND p.id IS NULL
      LIMIT 50
    `,
  },
  {
    name: "OwnershipHistory.member → Member",
    sql: `
      SELECT o.id AS child_id, o.member AS ref_id
      FROM ownership_history o
      LEFT JOIN members m ON m.id = o.member
      WHERE o.member IS NOT NULL AND o.member <> '' AND m.id IS NULL
      LIMIT 50
    `,
  },
];

async function main() {
  console.log("\nOrphan reference check (read-only)\n");
  let total = 0;
  const summary = [];

  for (const check of CHECKS) {
    try {
      const rows = await prisma.$queryRawUnsafe(check.sql);
      const count = rows.length;
      total += count;
      summary.push({ name: check.name, count, sample: rows.slice(0, 5) });
      const mark = count ? "FAIL" : "ok";
      console.log(`  [${mark}] ${check.name}: ${count}${count === 50 ? "+" : ""}`);
      if (count) {
        for (const row of rows.slice(0, 3)) {
          console.log(`         child=${row.child_id} ref=${row.ref_id}`);
        }
      }
    } catch (err) {
      console.error(`  [ERR] ${check.name}: ${err.message}`);
      summary.push({ name: check.name, count: -1, error: err.message });
      total += 1;
    }
  }

  console.log(`\nTotal orphan groups with hits: ${summary.filter((s) => s.count > 0).length}`);
  console.log(`Sample rows found (capped): ${total}\n`);
  await prisma.$disconnect();
  process.exit(total > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
