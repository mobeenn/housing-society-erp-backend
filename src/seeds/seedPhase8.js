const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { connectDB, db } = require("../config/db");
const env = require("../config/env");
const { PERMISSIONS } = require("../config/legacyPermissions");
const NoticeService = require("../modules/notices/service");

const VERSION = "phase8-2026.09.1";
const DEMO_PASSWORD = "DemoRole@123";

const stableId = (...parts) => crypto.createHash("sha256").update(`phase8-demo:${parts.join(":")}`).digest("hex").slice(0, 24);
const now = () => new Date().toISOString();
const dateOnly = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

const permissionPlan = {
  "Society Admin": [PERMISSIONS.NOTICES_CREATE, PERMISSIONS.NOTICES_MANAGE, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SETTINGS_MANAGE],
  "Property Officer": [PERMISSIONS.NOTICES_CREATE],
  "Finance Officer": [PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_FINANCIAL],
  "Operations Manager": [PERMISSIONS.NOTICES_CREATE, PERMISSIONS.INVENTORY_VIEW],
  "Security Manager": [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.SECURITY_CREATE, PERMISSIONS.SECURITY_EDIT, PERMISSIONS.SECURITY_MANAGE, PERMISSIONS.VISITORS_VIEW, PERMISSIONS.VISITORS_CREATE, PERMISSIONS.VEHICLES_VIEW],
  "Security Guard": [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.VISITORS_VIEW, PERMISSIONS.VISITORS_CREATE, PERMISSIONS.VEHICLES_VIEW],
  "HR Officer": [PERMISSIONS.NOTICES_CREATE],
  "Store Manager": [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.NOTICES_CREATE],
  "Procurement Officer": [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.NOTICES_CREATE],
  Receptionist: [PERMISSIONS.SECURITY_VIEW, PERMISSIONS.VISITORS_VIEW, PERMISSIONS.VISITORS_CREATE],
  Auditor: [PERMISSIONS.AUDIT_VIEW],
};

async function upsertUser({ id, name, email, roleId, memberId = null, passwordHash }) {
  const collection = db.collection("users");
  const existing = await collection.findOne({ _id: id });
  const record = {
    _id: id,
    name,
    email: email.toLowerCase(),
    phone: null,
    memberId,
    passwordHash,
    roles: [roleId],
    roleId,
    isActive: true,
    lastLoginAt: existing?.lastLoginAt || null,
    mustResetPassword: false,
    createdBy: existing?.createdBy || null,
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
  };
  if (existing) await collection.updateOne({ _id: id }, record);
  else await collection.insertOne(record);
  return record;
}

async function seed() {
  if (env.isProd) throw new Error("Phase 8 development seed cannot run in production");
  await connectDB();

  const roles = await db.collection("roles").find({});
  const roleByName = new Map(roles.map((role) => [role.name, role]));
  const admin = await db.collection("users").findOne({ email: (env.SUPERADMIN_EMAIL || "admin@housing-society.local").toLowerCase() });
  if (!admin) throw new Error("Super Admin is missing. Run npm run seed first.");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const role of roles) {
    const current = new Set((role.permissions || []).filter(Boolean));
    [PERMISSIONS.NOTICES_VIEW, PERMISSIONS.DASHBOARDS_VIEW, PERMISSIONS.REPORTS_VIEW].forEach((permission) => current.add(permission));
    (permissionPlan[role.name] || []).forEach((permission) => current.add(permission));
    role.permissions = Array.from(current);
    role.updatedAt = now();
    await db.collection("roles").updateOne({ _id: role._id }, { permissions: role.permissions, updatedAt: role.updatedAt });
  }

  const demoDefinitions = [
    ["Finance Officer", "finance.demo@housing.local", "Finance Demo User"],
    ["Operations Manager", "operations.demo@housing.local", "Operations Demo User"],
    ["Security Manager", "security.demo@housing.local", "Security Demo User"],
    ["Property Officer", "property.demo@housing.local", "Property Demo User"],
    ["HR Officer", "hr.demo@housing.local", "HR Demo User"],
    ["Store Manager", "store.demo@housing.local", "Store Demo User"],
    ["Procurement Officer", "procurement.demo@housing.local", "Procurement Demo User"],
    ["Receptionist", "receptionist.demo@housing.local", "Receptionist Demo User"],
  ];

  const demoUsers = {};
  for (const [roleName, email, name] of demoDefinitions) {
    const role = roleByName.get(roleName);
    if (!role) continue;
    const user = await upsertUser({ id: stableId("user", roleName), name, email, roleId: role._id, passwordHash });
    demoUsers[roleName] = user;
  }

  const member = await db.collection("members").findOne({}, { sort: { memberId: 1 } });
  if (member) {
    const memberUser = await upsertUser({
      id: stableId("user", "member-demo"),
      name: `${member.name} (Member Portal)`,
      email: "member.demo@housing.local",
      roleId: roleByName.get("Property Officer")?._id,
      memberId: member._id,
      passwordHash,
    });
    await db.collection("members").updateOne({ _id: member._id }, { userId: memberUser._id, updatedAt: now() });
  }

  if (member) {
    const documentCollection = db.collection("documents");
    const documentId = stableId("document", "ahmed-demo-membership");
    const existingDocument = await documentCollection.findOne({ _id: documentId });
    const documentRecord = {
      _id: documentId,
      relatedEntityType: "member",
      relatedEntityId: member._id,
      type: "Membership Record",
      number: "DEMO-MBR-0001",
      issueDate: dateOnly(-180),
      expiryDate: null,
      fileUrl: "/uploads/1790162090987-966166821d5e3472d4b99de0.pdf",
      fileName: "Ahmed Raza - Demo Membership Record.pdf",
      storageKey: "demo/ahmed-membership.pdf",
      mimeType: "application/pdf",
      size: 0,
      verificationStatus: "Verified",
      version: 1,
      isSuperseded: false,
      supersededBy: null,
      uploadedBy: admin._id,
      createdAt: now(),
      updatedAt: now(),
    };
    if (existingDocument) await documentCollection.updateOne({ _id: documentId }, documentRecord);
    else await documentCollection.insertOne(documentRecord);
  }

  const inventoryDefinitions = [
    ["INV-LED-001", "LED Streetlight Fitting", "Electrical", "unit", 8, 12],
    ["INV-CBL-001", "Power Cable 4mm", "Electrical", "meter", 65, 25],
    ["INV-PMP-001", "Water Pump Seal Kit", "Maintenance", "kit", 4, 8],
    ["INV-PNT-001", "Exterior Paint", "Maintenance", "bucket", 12, 10],
    ["INV-CLN-001", "Cleaning Supplies", "Cleaning", "pack", 3, 6],
    ["INV-SEC-001", "CCTV Replacement HDD", "Security", "unit", 2, 3],
    ["INV-PPR-001", "A4 Paper Ream", "Stationery", "ream", 18, 10],
    ["INV-FIL-001", "Water Filter Cartridge", "Plumbing", "unit", 5, 5],
  ];
  for (const [sku, name, category, unit, quantity, reorderLevel] of inventoryDefinitions) {
    const collection = db.collection("inventoryItems");
    const existing = await collection.findOne({ sku });
    const record = { sku, name, category, unit, quantity, reorderLevel, status: "Active", updatedAt: now() };
    if (existing) await collection.updateOne({ _id: existing._id }, record);
    else await collection.insertOne({ _id: stableId("inventory", sku), ...record, createdAt: now() });
  }

  const notices = [
    {
      title: "Monthly society maintenance window",
      body: "Water supply maintenance is scheduled for Sunday from 09:00 to 12:00. Please store water in advance.",
      targetAudience: "All",
      targetRoleIds: [],
      targetMemberIds: [],
      expiryDate: dateOnly(30),
    },
    {
      title: "Security briefing for guards and reception staff",
      body: "Please review the updated visitor verification checklist and report any suspicious activity immediately.",
      targetAudience: "Role-based",
      targetRoleIds: [roleByName.get("Security Manager")?._id, roleByName.get("Security Guard")?._id].filter(Boolean),
      targetMemberIds: [],
      expiryDate: dateOnly(60),
    },
    {
      title: "Finance office collection hours",
      body: "The finance office will remain open until 17:00 during the current collection period.",
      targetAudience: "Specific members",
      targetRoleIds: [],
      targetMemberIds: member ? [member._id] : [],
      expiryDate: dateOnly(14),
    },
  ];
  for (const noticeData of notices) {
    const collection = db.collection("notices");
    const existing = await collection.findOne({ title: noticeData.title });
    if (existing) {
      await collection.updateOne({ _id: existing._id }, { ...noticeData, status: "Published", updatedAt: now() });
      await NoticeService.publish(existing._id);
    } else {
      await NoticeService.create({ ...noticeData, publishDate: now(), status: "Published" }, admin._id);
    }
  }

  await db.save();
  console.log(`\n🌱 Phase 8 development seed ${VERSION} completed.`);
  console.log(`   Added/updated ${demoUsers ? Object.keys(demoUsers).length : 0} role demo users.`);
  console.log("   Added 8 inventory items, 3 notices and member notification linkage.");
  console.log("   Demo password for role users: DemoRole@123\n");
}

if (require.main === module) {
  seed().catch((error) => {
    console.error("Phase 8 seed failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { seed, VERSION, DEMO_PASSWORD };
