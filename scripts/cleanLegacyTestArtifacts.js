/**
 * Remove leftover test artifacts from data/db.json.
 *
 * The legacy fileDB test suite created rows directly in db.json. Those rows
 * were never imported into Postgres (the import ran against the pre-test
 * snapshot and the import script is upsert-only), so the file has drifted
 * slightly ahead of the database.
 *
 * This script deletes exactly the records that are NOT in the import baseline
 * (data/.baseline-ids.json) and writes a backup first. Nothing that was
 * migrated can be touched: if a record is in the manifest, it is left alone.
 *
 * Run: node scripts/cleanLegacyTestArtifacts.js [--apply]
 */
const fs = require("fs");
const path = require("path");

const DB_FILE = path.resolve(__dirname, "../data/db.json");
const MANIFEST = path.resolve(__dirname, "../data/.baseline-ids.json");
const BACKUP = path.resolve(__dirname, "../data/db.json.backup");
const APPLY = process.argv.includes("--apply");

// db.json collection -> Prisma model name used by the manifest
const MAP = {
  auditLogs: "AuditLog",
  invoices: "Invoice",
  notifications: "Notification",
  members: "Member",
  plots: "Plot",
  bookings: "Booking",
  installments: "Installment",
  payments: "Payment",
  expenses: "Expense",
  vendors: "Vendor",
  complaints: "Complaint",
  workOrders: "WorkOrder",
  assets: "Asset",
  employees: "Employee",
  attendance: "Attendance",
  vehicles: "Vehicle",
  visitors: "VisitorEntry",
  userRoles: "UserRole",
};

/** Keys a notification must look like to be considered a test artifact. */
function describe(kind, row) {
  if (kind === "Notification") {
    return `${row.title} | entity=${row.relatedEntityType}#${row.relatedEntityId} | user=${row.user}`;
  }
  if (kind === "Invoice") {
    return `${row.invoiceNumber} | ${row.invoiceType} -> ${row.relatedEntityType}#${row.relatedEntityId}`;
  }
  if (kind === "AuditLog") {
    return `${row.action} | ${row.entityType || "-"}${row.entityId ? `#${row.entityId}` : ""} | user=${row.userId || "-"}`;
  }
  return `${row._id}`;
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error("Baseline manifest missing. Run: node scripts/snapshotBaseline.js save");
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

  const removals = [];
  let scanned = 0;

  for (const [collection, modelName] of Object.entries(MAP)) {
    if (!Array.isArray(db[collection]) || !db[collection].length) continue;
    const keep = new Set(manifest[modelName] || []);
    scanned += db[collection].length;
    const survivors = [];
    for (const row of db[collection]) {
      if (keep.has(row._id)) {
        survivors.push(row);
      } else {
        removals.push({ collection, modelName, row });
      }
    }
    db[collection] = survivors;
  }

  console.log(`\nscanned ${scanned} record(s) across ${Object.keys(MAP).length} collections`);
  console.log(`candidates for removal: ${removals.length}`);
  if (removals.length) {
    console.log("\nwill remove:");
    for (const item of removals) {
      console.log(`  - ${item.collection}: ${describe(item.collection, item.row)}`);
    }
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write the change.");
    return;
  }
  if (!removals.length) {
    console.log("\nNothing to remove.");
    return;
  }

  fs.copyFileSync(DB_FILE, BACKUP);
  fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  console.log(`\nbackup written: ${BACKUP}`);
  console.log(`removed ${removals.length} record(s) from data/db.json`);
}

main();
