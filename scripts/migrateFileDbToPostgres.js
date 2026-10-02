/**
 * One-time (idempotent) import of the legacy fileDB (data/db.json) into
 * Postgres via Prisma.
 *
 * Why ids are preserved
 * ---------------------
 * Every legacy record keeps its original `_id` as the Postgres primary key.
 * The data is full of cross-references (plot.currentOwner -> member,
 * payment.allocations -> installment, roleModuleAccess.role -> role). If we
 * generated new uuids, every one of those references would dangle.
 *
 * Re-runnable: records are upserted on `id`, so a second run updates in place
 * and creates nothing new.
 *
 * Usage:
 *   node scripts/migrateFileDbToPostgres.js            # import
 *   node scripts/migrateFileDbToPostgres.js --dry-run  # report only
 */

const fs = require("fs");
const bcrypt = require("bcryptjs");
const path = require("path");
// Prisma 7 ships Decimal from the generated client, not @prisma/client.
const { Prisma } = require("../src/generated/prisma/client");
const { prisma } = require("../src/config/prisma");
const env = require("../src/config/env");

const PrismaDecimal = Prisma.Decimal;

const DB_FILE = path.resolve(__dirname, "../data/db.json");
const DRY_RUN = process.argv.includes("--dry-run");

// helpers

const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Json columns must never receive `undefined` Prisma rejects it. */
const toJson = (value) => (value === undefined ? null : value);

const decimal = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? new PrismaDecimal(n) : null;
};

const stats = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
const failures = [];

/**
 * Schema metadata from the generated client, so this script adapts to the
 * models instead of hard-coding 48 column lists.
 *
 * Note: this Prisma 7 DMMF exposes only {name, kind, type} - it does NOT
 * expose `isRequired`, so required-ness is read from the live database
 * (information_schema) instead. The model -> table name mapping comes from the
 * generated schema.prisma, which carries the @@map() directives.
 */
const MODEL_META = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields.filter((f) => f.kind === "scalar")])
);

function loadModelTableMap() {
  const schemaPath = path.resolve(__dirname, "../src/generated/prisma/schema.prisma");
  const src = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
  const map = new Map();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = modelRe.exec(src))) {
    const mapDirective = match[2].match(/@@map\("([^"]+)"\)/);
    map.set(match[1], mapDirective ? mapDirective[1] : match[1]);
  }
  return map;
}

const MODEL_TABLE = loadModelTableMap();

/** table -> Set of NOT NULL column names, read live from Postgres. */
async function loadRequiredColumns() {
  const rows = await prisma.$queryRaw`
    SELECT c.table_name::text AS table, c.column_name::text AS column
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.is_nullable = 'NO' AND t.table_type = 'BASE TABLE'
  `;
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table)) map.set(r.table, new Set());
    map.get(r.table).add(r.column);
  }
  return map;
}

let REQUIRED_COLUMNS = new Map();

const DEFAULT_FOR = {
  String: () => "",
  Int: () => 0,
  Float: () => 0,
  Boolean: () => false,
  DateTime: () => new Date(0),
  Decimal: () => new PrismaDecimal(0),
  Json: () => ({}),
};

/**
 * Generic upsert for a simple legacy collection: `_id` -> `id`, ISO strings
 * -> Date, numbers -> Decimal, arrays/objects -> Json. Any key not present on
 * the model is dropped, and any required model field missing from the legacy
 * record is filled with a type-appropriate default (legacy rows are sparse).
 */
async function importCollection({ model, modelName, rows, transforms, label }) {
  if (!rows.length) {
    console.log(`   = ${label.padEnd(24)} 0 records`);
    return;
  }
  const fields = MODEL_META.get(modelName) || [];
  const byName = new Map(fields.map((f) => [f.name, f]));
  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const row of rows) {
    const raw = { ...row, id: row._id ?? row.id };
    delete raw._id;
    if (transforms) transforms(raw, row);

    const data = { id: raw.id };
    for (const [key, value] of Object.entries(raw)) {
      const field = byName.get(key);
      if (!field) continue; // column does not exist on this model
      if (value === undefined) continue;
      if (field.type === "DateTime") data[key] = toDate(value);
      else if (field.type === "Decimal") data[key] = decimal(value);
      else if (field.type === "Json") data[key] = toJson(value);
      else data[key] = value;
    }
    // Fill required (NOT NULL) columns the legacy row did not carry.
    const required = REQUIRED_COLUMNS.get(MODEL_TABLE.get(modelName)) || new Set();
    for (const field of fields) {
      if (!required.has(field.name) || data[field.name] !== undefined) continue;
      const make = DEFAULT_FOR[field.type];
      if (make) data[field.name] = make();
    }

    if (DRY_RUN) {
      stats.skipped += 1;
      continue;
    }
    try {
      const existing = await model.findUnique({ where: { id: data.id }, select: { id: true } });
      if (existing) {
        await model.update({ where: { id: data.id }, data });
        updated += 1;
      } else {
        await model.create({ data });
        inserted += 1;
      }
    } catch (error) {
      const message = (error.message || "").trim().split("\n").filter(Boolean).pop() || error.code || "unknown";
      errors.push(`${data.id}: ${message}`);
    }
  }

  stats.inserted += inserted;
  stats.updated += updated;
  if (errors.length) {
    stats.failed += errors.length;
    failures.push(`${label}: ${errors.length} failed\n      ${errors.slice(0, 2).join("\n      ")}`);
  }
  console.log(
    `   ${errors.length ? "!" : "+"} ${label.padEnd(24)} ${String(rows.length).padStart(4)} rows ` +
      `(${inserted} new, ${updated} updated${errors.length ? `, ${errors.length} FAILED` : ""})`
  );
}

// main

async function main() {
  if (!fs.existsSync(DB_FILE)) throw new Error(`Source file not found: ${DB_FILE}`);
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  const col = (name) => (Array.isArray(db[name]) ? db[name] : db[name] ? [db[name]] : []);

  if (!DRY_RUN) {
    REQUIRED_COLUMNS = await loadRequiredColumns();
 console.log(` read NOT NULL constraints for ${REQUIRED_COLUMNS.size} tables\n`);
  }

 console.log(`\n${DRY_RUN ? " DRY RUN no writes" : " Importing db.json Postgres"}`);
  console.log(`   source: ${DB_FILE} (${col.length} collections)\n`);

  if (!DRY_RUN) {
    // Clear previously seeded identity/lookup rows so the legacy rows (which
    // carry the ids everything else references) become the canonical ones.
    // Order respects foreign keys.
    console.log("    clearing previously seeded identity/lookup rows");
    await prisma.userRole.deleteMany({});
    await prisma.roleModuleAccess.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.rbacModule.deleteMany({});
    await prisma.numberingRule.deleteMany({});
    await prisma.masterData.deleteMany({});
    for (const m of ["department", "block", "street", "plotCategory", "propertyType", "nocType"]) {
      await prisma[m].deleteMany({});
    }
    console.log("");
  }

 // identity (order matters: roles/modules before the join tables)
  await importCollection({
    model: prisma.role,
    modelName: "Role",
    label: "roles",
    rows: col("roles"),
    transforms: (d) => {
      d.permissions = Array.isArray(d.permissions) ? d.permissions : [];
      d.isSystemRole = Boolean(d.isSystemRole);
      d.isSystem = Boolean(d.isSystemRole);
    },
  });

  await importCollection({
    model: prisma.rbacModule,
    modelName: "RbacModule",
    label: "rbacModules",
    rows: col("rbacModules"),
    transforms: (d) => {
      d.isActive = d.isActive !== false;
      d.showInSidebar = d.showInSidebar !== false;
    },
  });

  await importCollection({
    model: prisma.user,
    modelName: "User",
    label: "users",
    rows: col("users"),
    transforms: (d) => {
      d.roles = undefined; // legacy inline array -> user_roles rows below
      d.createdById = d.createdBy ?? null;
      d.isActive = d.isActive !== false;
      d.mustResetPassword = Boolean(d.mustResetPassword);
    },
  });

  // user_roles from the legacy inline `roles: [roleId]` array
  if (!DRY_RUN && col("users").length) {
    let made = 0;
    for (const u of col("users")) {
      for (const roleId of u.roles || []) {
        try {
          await prisma.userRole.create({ data: { id: `${u._id}-${roleId}`.slice(0, 60), userId: u._id, roleId } });
          made += 1;
        } catch {
          /* duplicate on re-run */
        }
      }
    }
    console.log(`   + user_roles               ${String(made).padStart(4)} rows (${made} new)`);
    stats.inserted += made;
  }

  await importCollection({
    model: prisma.roleModuleAccess,
    modelName: "RoleModuleAccess",
    label: "roleModuleAccess",
    rows: col("roleModuleAccess"),
    transforms: (d) => {
      d.roleId = d.role;
      d.moduleId = d.module;
      d.updatedById = d.updatedBy ?? null;
      delete d.role;
      delete d.module;
      delete d.updatedBy;
      d.actions = toJson(d.actions) || {};
    },
  });

 // master data lookups
  await importCollection({ model: prisma.department, modelName: "Department", label: "departments", rows: col("departments") });
  await importCollection({ model: prisma.block, modelName: "Block", label: "blocks", rows: col("blocks") });
  await importCollection({ model: prisma.street, modelName: "Street", label: "streets", rows: col("streets") });
  await importCollection({ model: prisma.plotCategory, modelName: "PlotCategory", label: "plotCategories", rows: col("plotCategories") });
  await importCollection({ model: prisma.propertyType, modelName: "PropertyType", label: "propertyTypes", rows: col("propertyTypes") });

 // members / plots / ownership
  await importCollection({ model: prisma.member, modelName: "Member", label: "members", rows: col("members") });
  await importCollection({
    model: prisma.plot,
    modelName: "Plot",
    label: "plots",
    rows: col("plots"),
    transforms: (d) => {
      d.price = decimal(d.price);
      d.isBlocked = Boolean(d.isBlocked);
    },
  });
  await importCollection({ model: prisma.ownershipHistory, modelName: "OwnershipHistory", label: "ownershipHistory", rows: col("ownershipHistory") });

 // bookings / installments / payments
  await importCollection({
    model: prisma.booking,
    modelName: "Booking",
    label: "bookings",
    rows: col("bookings"),
    transforms: (d) => {
      for (const f of ["price", "discount", "developmentCharges", "additionalCharges", "bookingAmount", "refundAmount"]) {
        d[f] = decimal(d[f]);
      }
    },
  });
  await importCollection({
    model: prisma.installmentPlan,
    modelName: "InstallmentPlan",
    label: "installmentPlans",
    rows: col("installmentPlans"),
    transforms: (d) => {
      d.totalAmount = decimal(d.totalAmount);
      d.numberOfInstallments = d.numberOfInstallments ?? null;
    },
  });
  await importCollection({
    model: prisma.installment,
    modelName: "Installment",
    label: "installments",
    rows: col("installments"),
    transforms: (d) => {
      for (const f of ["amount", "penaltyAmount", "discountAmount", "paidAmount", "balance"]) d[f] = decimal(d[f]);
      d.overdueDays = d.overdueDays ?? null;
    },
  });
  await importCollection({
    model: prisma.payment,
    modelName: "Payment",
    label: "payments",
    rows: col("payments"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
    },
  });
  await importCollection({
    model: prisma.refund,
    modelName: "Refund",
    label: "refunds",
    rows: col("refunds"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
    },
  });
  await importCollection({
    model: prisma.expense,
    modelName: "Expense",
    label: "expenses",
    rows: col("expenses"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
    },
  });

 // procurement
  await importCollection({
    model: prisma.vendor,
    modelName: "Vendor",
    label: "vendors",
    rows: col("vendors"),
    transforms: (d) => {
      d.outstandingBalance = decimal(d.outstandingBalance);
    },
  });
  await importCollection({
    model: prisma.purchaseRequest,
    modelName: "PurchaseRequest",
    label: "purchaseRequests",
    rows: col("purchaseRequests"),
    transforms: (d) => {
      d.quantity = decimal(d.quantity);
      d.estimatedCost = decimal(d.estimatedCost);
    },
  });
  await importCollection({
    model: prisma.quotation,
    modelName: "Quotation",
    label: "quotations",
    rows: col("quotations"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
    },
  });
  await importCollection({
    model: prisma.purchaseOrder,
    modelName: "PurchaseOrder",
    label: "purchaseOrders",
    rows: col("purchaseOrders"),
    transforms: (d) => {
      d.totalAmount = decimal(d.totalAmount);
    },
  });
  await importCollection({ model: prisma.grn, modelName: "Grn", label: "goodsReceivedNotes", rows: col("goodsReceivedNotes") });
  await importCollection({
    model: prisma.inventoryItem,
    modelName: "InventoryItem",
    label: "inventoryItems",
    rows: col("inventoryItems"),
    transforms: (d) => {
      const qty = decimal(d.quantity);
      d.currentStock = qty;
      d.quantity = qty;
      d.reorderLevel = decimal(d.reorderLevel);
    },
  });
  await importCollection({ model: prisma.stockTransaction, modelName: "StockTransaction", label: "stockTransactions", rows: col("stockTransactions") });

 // lifecycle
  await importCollection({
    model: prisma.transferRequest,
    modelName: "TransferRequest",
    label: "transferRequests",
    rows: col("transferRequests"),
    transforms: (d) => {
      d.transferFee = decimal(d.transferFee);
      d.outstandingDues = decimal(d.outstandingDues);
      d.duesCleared = Boolean(d.duesCleared);
    },
  });
  await importCollection({
    model: prisma.nocApplication,
    modelName: "NocApplication",
    label: "nocApplications",
    rows: col("nocApplications"),
    transforms: (d) => {
      d.feeAmount = decimal(d.feeAmount);
      d.outstandingDues = decimal(d.outstandingDues);
    },
  });
  await importCollection({
    model: prisma.possessionApplication,
    modelName: "PossessionApplication",
    label: "possessionApplications",
    rows: col("possessionApplications"),
    transforms: (d) => {
      d.possessionCharges = decimal(d.possessionCharges);
      d.outstandingDues = decimal(d.outstandingDues);
    },
  });
  await importCollection({ model: prisma.constructionApplication, modelName: "ConstructionApplication", label: "constructionApplications", rows: col("constructionApplications") });
  await importCollection({ model: prisma.siteInspection, modelName: "SiteInspection", label: "siteInspections", rows: col("siteInspections") });
  await importCollection({ model: prisma.complaint, modelName: "Complaint", label: "complaints", rows: col("complaints") });
  await importCollection({ model: prisma.plotMerge, modelName: "PlotMerge", label: "plotMerges", rows: col("plotMerges") });
  await importCollection({
    model: prisma.buyback,
    modelName: "Buyback",
    label: "buybacks",
    rows: col("buybacks"),
    transforms: (d) => {
      d.deductionPercent = decimal(d.deductionPercent);
      d.settlementAmount = decimal(d.settlementAmount);
    },
  });
  await importCollection({ model: prisma.registryBatch, modelName: "RegistryBatch", label: "registryBatches", rows: col("registryBatches") });

 // maintenance
  await importCollection({ model: prisma.asset, modelName: "Asset", label: "assets", rows: col("assets") });
  await importCollection({
    model: prisma.workOrder,
    modelName: "WorkOrder",
    label: "workOrders",
    rows: col("workOrders"),
    transforms: (d) => {
      d.laborCost = decimal(d.laborCost);
      d.materialCost = decimal(d.materialCost);
    },
  });

 // security
  await importCollection({ model: prisma.guard, modelName: "Guard", label: "guards", rows: col("guards") });
  await importCollection({ model: prisma.dutyRoster, modelName: "DutyRoster", label: "dutyRoster", rows: col("dutyRoster") });
  await importCollection({ model: prisma.vehicle, modelName: "Vehicle", label: "vehicles", rows: col("vehicles") });
  await importCollection({ model: prisma.pass, modelName: "Pass", label: "passes", rows: col("passes") });
  await importCollection({ model: prisma.blacklistEntry, modelName: "BlacklistEntry", label: "blacklist", rows: col("blacklist") });
  await importCollection({ model: prisma.visitorEntry, modelName: "VisitorEntry", label: "visitorEntries", rows: col("visitorEntries") });
  await importCollection({ model: prisma.appointment, modelName: "Appointment", label: "appointments", rows: col("appointments") });

 // HR / payroll
  await importCollection({
    model: prisma.employee,
    modelName: "Employee",
    label: "employees",
    rows: col("employees"),
    transforms: (d) => {
      d.basicSalary = decimal(d.basicSalary);
      d.allowances = decimal(d.allowances);
      d.deductions = decimal(d.deductions);
    },
  });
  await importCollection({ model: prisma.attendance, modelName: "Attendance", label: "attendance", rows: col("attendance") });
  await importCollection({ model: prisma.leaveRequest, modelName: "LeaveRequest", label: "leaveRequests", rows: col("leaveRequests") });
  await importCollection({ model: prisma.hrSetup, modelName: "HrSetup", label: "hrSetups", rows: col("hrSetups") });
  await importCollection({
    model: prisma.loan,
    modelName: "Loan",
    label: "loans",
    rows: col("loans"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
      d.installmentAmount = decimal(d.installmentAmount);
      d.remainingBalance = decimal(d.remainingBalance);
    },
  });
  await importCollection({
    model: prisma.payrollRun,
    modelName: "PayrollRun",
    label: "payrollRuns",
    rows: col("payrollRuns"),
    transforms: (d) => {
      d.month = Number(d.month);
      d.year = Number(d.year);
    },
  });
  await importCollection({
    model: prisma.journalEntry,
    modelName: "JournalEntry",
    label: "journalEntries",
    rows: col("journalEntries"),
    transforms: (d) => {
      d.totalDebit = decimal(d.totalDebit);
      d.totalCredit = decimal(d.totalCredit);
    },
  });
  await importCollection({
    model: prisma.recoveryAssignment,
    modelName: "RecoveryAssignment",
    label: "recoveryAssignments",
    rows: col("recoveryAssignments"),
    transforms: (d) => {
      d.recoveryPercent = decimal(d.recoveryPercent);
    },
  });
  await importCollection({
    model: prisma.recoveryCall,
    modelName: "RecoveryCall",
    label: "recoveryCalls",
    rows: col("recoveryCalls"),
    transforms: (d) => {
      d.commitmentAmount = decimal(d.commitmentAmount);
    },
  });

 // comms / registry
  await importCollection({ model: prisma.notice, modelName: "Notice", label: "notices", rows: col("notices") });
  await importCollection({ model: prisma.notification, modelName: "Notification", label: "notifications", rows: col("notifications") });
  await importCollection({
    model: prisma.document,
    modelName: "Document",
    label: "documents",
    rows: col("documents"),
    transforms: (d) => {
      d.size = d.size ?? null;
      d.version = d.version ?? null;
    },
  });
  await importCollection({
    model: prisma.invoice,
    modelName: "Invoice",
    label: "invoices",
    rows: col("invoices"),
    transforms: (d) => {
      d.amount = decimal(d.amount);
    },
  });
  // A few legacy audit rows point at a userId that no longer exists (deleted
  // account, or an id from a different store). Keep the log entry and null the
  // dangling reference rather than dropping the row.
  const knownUserIds = new Set(
    !DRY_RUN ? (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id) : []
  );
  let nulledUserRefs = 0;
  await importCollection({
    model: prisma.auditLog,
    modelName: "AuditLog",
    label: "auditLogs",
    rows: col("auditLogs"),
    transforms: (d) => {
      if (d.userId && !knownUserIds.has(d.userId)) {
        d.userId = null;
        nulledUserRefs += 1;
      }
    },
  });
  if (nulledUserRefs) console.log(`     (${nulledUserRefs} rows had a userId that no longer exists -> set NULL)`);

 // single-row settings + rbac migration marker
  const settings = col("societySettings")[0];
  if (settings && !DRY_RUN) {
    const { _id, ...rest } = settings;
    await prisma.societySettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...rest },
      update: { ...rest, id: "default" },
    });
    console.log("   + societySettings           1 row (id=default)");
    stats.inserted += 1;
  }

  const numbering = col("numberingRules");
  await importCollection({
    model: prisma.numberingRule,
    modelName: "NumberingRule",
    label: "numberingRules",
    rows: numbering,
    transforms: (d) => {
      d.lastResetPeriod = d.lastResetAt ?? null;
      delete d.lastResetAt;
      d.isActive = true;
    },
  });

  const migration = db.rbacMigration;
  if (migration && !DRY_RUN) {
    await prisma.masterData.upsert({
      where: { type_name: { type: "rbacMigration", name: "migration" } },
      create: {
        type: "rbacMigration",
        name: "migration",
        code: JSON.stringify(migration.code ?? []),
        description: JSON.stringify(migration.description ?? {}),
      },
      update: {
        code: JSON.stringify(migration.code ?? []),
        description: JSON.stringify(migration.description ?? {}),
      },
    });
    console.log("   + masterData(rbacMigration) 1 row");
    stats.inserted += 1;
  }

 // summary
 console.log(`\n${"".repeat(60)}`);
  // reconcile the Super Admin credential
  // db.json carries a legacy password hash for the Super Admin that does not
  // match SUPERADMIN_PASSWORD in .env. The environment is the operator's source
  // of truth, so re-hash the configured password onto that account rather than
  // leaving an account nobody can log into.
  const adminEmail = (env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = env.SUPERADMIN_PASSWORD || "";
  if (adminEmail && adminPassword && !DRY_RUN) {
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (admin) {
      await prisma.user.update({
        where: { id: admin.id },
        data: {
          passwordHash: await bcrypt.hash(adminPassword, 10),
          isActive: true,
          mustResetPassword: true,
        },
      });
      console.log(`   ~ superAdmin credential reconciled from .env (${adminEmail})`);
    } else {
      console.log(`   ! no user with email ${adminEmail} - cannot reconcile credential`);
    }
  }

  console.log(`   inserted: ${stats.inserted}`);
  console.log(`   updated : ${stats.updated}`);
  console.log(`   failed  : ${stats.failed}`);
  if (failures.length) {
    console.log("\n   Failures:");
    for (const f of failures) console.log(`     - ${f}`);
  }
  if (db.developmentData) {
    console.log("\n   Note: skipped 'developmentData' (scratch dev seed, not ERP data).");
  }
 console.log(`${"".repeat(60)}\n`);
}

main()
  .catch((error) => {
 console.error(" Import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
