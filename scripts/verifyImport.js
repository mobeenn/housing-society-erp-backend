/**
 * Verify the Postgres import against data/db.json.
 * Compares row counts per table and reports any collection that did not match.
 *
 * Run: node scripts/verifyImport.js
 */
const fs = require("fs");
const path = require("path");
const { prisma } = require("../src/config/prisma");

const DB_FILE = path.resolve(__dirname, "../data/db.json");
const MANIFEST = path.resolve(__dirname, "../data/.baseline-ids.json");

// db.json collection -> { model, key }
const MAP = {
  roles: "role",
  rbacModules: "rbacModule",
  users: "user",
  roleModuleAccess: "roleModuleAccess",
  departments: "department",
  blocks: "block",
  streets: "street",
  plotCategories: "plotCategory",
  propertyTypes: "propertyType",
  members: "member",
  plots: "plot",
  ownershipHistory: "ownershipHistory",
  bookings: "booking",
  installmentPlans: "installmentPlan",
  installments: "installment",
  payments: "payment",
  refunds: "refund",
  expenses: "expense",
  vendors: "vendor",
  purchaseRequests: "purchaseRequest",
  quotations: "quotation",
  purchaseOrders: "purchaseOrder",
  goodsReceivedNotes: "grn",
  inventoryItems: "inventoryItem",
  transferRequests: "transferRequest",
  nocApplications: "nocApplication",
  possessionApplications: "possessionApplication",
  constructionApplications: "constructionApplication",
  siteInspections: "siteInspection",
  complaints: "complaint",
  plotMerges: "plotMerge",
  buybacks: "buyback",
  registryBatches: "registryBatch",
  assets: "asset",
  workOrders: "workOrder",
  guards: "guard",
  dutyRoster: "dutyRoster",
  vehicles: "vehicle",
  passes: "pass",
  blacklist: "blacklistEntry",
  visitorEntries: "visitorEntry",
  appointments: "appointment",
  employees: "employee",
  attendance: "attendance",
  leaveRequests: "leaveRequest",
  hrSetups: "hrSetup",
  loans: "loan",
  payrollRuns: "payrollRun",
  journalEntries: "journalEntry",
  recoveryAssignments: "recoveryAssignment",
  recoveryCalls: "recoveryCall",
  notices: "notice",
  notifications: "notification",
  documents: "document",
  invoices: "invoice",
  auditLogs: "auditLog",
  numberingRules: "numberingRule",
  societySettings: "societySettings",
};

async function main() {
  const useManifest = process.argv.includes("--manifest");
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const manifest = useManifest && fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : null;

  if (useManifest && !manifest) {
    throw new Error("Baseline manifest not found. Run: node scripts/snapshotBaseline.js save");
  }

  const rows = [];
  let mismatches = 0;
  let totalSource = 0;
  let totalTarget = 0;

  for (const [collection, modelKey] of Object.entries(MAP)) {
    const modelName = modelKey.charAt(0).toUpperCase() + modelKey.slice(1);
    // Singletons/settings are deliberately excluded from the manifest, so in
    // manifest mode they are reported, not counted as mismatches.
    const notInManifest = Boolean(manifest) && !manifest[modelName];

    const source = manifest
      ? (manifest[modelName] || []).length
      : Array.isArray(db[collection])
        ? db[collection].length
        : db[collection]
          ? 1
          : 0;
    const target = await prisma[modelKey].count();

    if (notInManifest) {
      rows.push({ collection, table: modelKey, source: "-", target, status: "SKIPPED" });
      continue;
    }

    totalSource += source;
    totalTarget += target;
    const ok = source === target;
    if (!ok) mismatches += 1;
    rows.push({ collection, table: modelKey, source, target, status: ok ? "OK" : "MISMATCH" });
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad("db.json collection", 30)}${pad("table", 24)}${pad("source", 8)}${pad("postgres", 10)}status`);
  console.log("-".repeat(82));
  for (const r of rows.sort((a, b) => a.collection.localeCompare(b.collection))) {
    console.log(`${pad(r.collection, 30)}${pad(r.table, 24)}${pad(r.source, 8)}${pad(r.target, 10)}${r.status}`);
  }
  console.log("-".repeat(82));
  console.log(`${pad("TOTAL", 54)}${pad(totalSource, 8)}${pad(totalTarget, 10)}`);
  console.log(`\nmismatches: ${mismatches}`);

  // A few spot checks that the data is usable, not just present.
  const sample = await prisma.member.findFirst({
    where: { cnic: { not: null } },
    select: { name: true, cnic: true, memberId: true },
  });
  const owned = await prisma.plot.count({ where: { currentOwner: { not: null } } });
  const payTotal = await prisma.payment.aggregate({ _sum: { amount: true } });
  console.log(`\nspot checks:`);
  console.log(`  sample member      : ${sample ? `${sample.name} (${sample.memberId}, CNIC ${sample.cnic})` : "none"}`);
  console.log(`  plots with owner   : ${owned}`);
  console.log(`  total payments     : ${payTotal._sum.amount ?? 0}`);
  console.log(`  roles              : ${await prisma.role.count()}`);
  console.log(`  rbac modules       : ${await prisma.rbacModule.count()}`);
  console.log(`  role access rows   : ${await prisma.roleModuleAccess.count()}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
