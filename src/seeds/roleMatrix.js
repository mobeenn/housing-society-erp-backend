/**
 * P2-2 client-facing permission matrix (IMPROVEMENT_PLAN).
 * Legend codes are expanded to RoleModuleAccess actions.
 * Delete is Admin-only. Super Admin is full bypass (not in this matrix).
 */

const ACTIONS = ["view", "create", "edit", "delete", "approve", "reject", "cancel", "print", "export", "refund"];

const ROLE_NAMES = [
  "Society Admin",
  "Property Officer",
  "Finance Officer",
  "Operations Manager",
  "Security Manager",
  "Security Guard",
  "HR Officer",
  "Store & Procurement Officer",
  "Receptionist",
  "Auditor",
];

function blank() {
  return Object.fromEntries(ACTIONS.map((a) => [a, false]));
}

function pack(flags) {
  const actions = blank();
  for (const [k, v] of Object.entries(flags)) {
    if (ACTIONS.includes(k)) actions[k] = v === true;
  }
  const isVisible = ACTIONS.some((a) => actions[a]);
  return { isVisible, actions };
}

const V = () => pack({ view: true });
const E = () => pack({ view: true, create: true, edit: true });
const A = () => pack({ view: true, approve: true, reject: true });
const EA = () => pack({ view: true, create: true, edit: true, approve: true, reject: true });
const VA = () => pack({ view: true, approve: true, reject: true });
const REQ = () => pack({ view: true, create: true }); // refund request
const PAY = () => pack({ view: true, create: true, edit: true }); // pay after approval via edit
const CREATE = () => pack({ view: true, create: true });
const DRAFT = () => pack({ view: true, create: true });
const V_EXPORT = () => pack({ view: true, export: true, print: true });
const ALL_REPORTS = () => pack({ view: true, export: true, print: true });
const ADMIN_E = () =>
  pack({
    view: true,
    create: true,
    edit: true,
    delete: true,
    approve: true,
    reject: true,
    cancel: true,
    print: true,
    export: true,
    refund: true,
  });
const ADMIN_MODULE = () =>
  pack({
    view: true,
    create: true,
    edit: true,
    delete: true,
    approve: true,
    reject: true,
    cancel: true,
    print: true,
    export: true,
  });
const NONE = () => pack({});

/**
 * moduleKey → roleName → grant factory result
 * Modules omitted for a role default to NONE when applying.
 */
const MATRIX = {
  dashboards: {
    "Society Admin": V,
    "Property Officer": V,
    "Finance Officer": V,
    "Operations Manager": V,
    "Security Manager": V,
    "Security Guard": V,
    "HR Officer": V,
    "Store & Procurement Officer": V,
    Receptionist: V,
    Auditor: V,
  },
  members: {
    "Society Admin": ADMIN_MODULE,
    "Property Officer": E,
    "Finance Officer": V,
    "Operations Manager": V,
    // Security Manager / Guard: lookup-only via /api/lookups (no module grant)
    Receptionist: V,
    Auditor: V,
  },
  plots: {
    "Society Admin": ADMIN_MODULE,
    "Property Officer": E,
    "Finance Officer": V,
    "Operations Manager": V,
    Receptionist: V,
    Auditor: V,
  },
  bookings: {
    "Society Admin": ADMIN_MODULE,
    "Property Officer": E,
    "Finance Officer": V,
    "Operations Manager": V,
    Receptionist: V,
    Auditor: V,
  },
  installments: {
    "Society Admin": VA,
    "Property Officer": V,
    "Finance Officer": E,
    Auditor: V,
  },
  payments: {
    "Society Admin": VA,
    "Property Officer": V,
    "Finance Officer": E,
    Auditor: V,
  },
  refunds: {
    "Society Admin": () =>
      pack({ view: true, approve: true, reject: true, refund: true }),
    "Property Officer": REQ,
    "Finance Officer": () =>
      pack({ view: true, create: true, edit: true, refund: true }),
    Auditor: V,
  },
  expenses: {
    "Society Admin": A,
    "Finance Officer": PAY,
    Auditor: V,
  },
  recovery: {
    "Society Admin": A,
    "Property Officer": V,
    "Finance Officer": E,
    "Operations Manager": V,
    Auditor: V,
  },
  transfers: {
    "Society Admin": A,
    "Property Officer": E,
    "Finance Officer": E,
    Receptionist: V,
    Auditor: V,
  },
  nocs: {
    "Society Admin": A,
    "Property Officer": E,
    "Finance Officer": E,
    Receptionist: V,
    Auditor: V,
  },
  possession: {
    "Society Admin": A,
    "Property Officer": E,
    "Finance Officer": E,
    Receptionist: V,
    Auditor: V,
  },
  construction: {
    "Society Admin": A,
    "Property Officer": E,
    "Finance Officer": E,
    Receptionist: V,
    Auditor: V,
  },
  registry: {
    "Society Admin": A,
    "Property Officer": E,
    "Finance Officer": E,
    Receptionist: V,
    Auditor: V,
  },
  "plot-merge": {
    "Society Admin": A,
    Auditor: V,
  },
  buyback: {
    "Society Admin": A,
    Auditor: V,
  },
  complaints: {
    "Society Admin": VA,
    "Property Officer": V,
    "Operations Manager": E,
    Receptionist: CREATE,
    Auditor: V,
  },
  maintenance: {
    "Society Admin": V,
    "Operations Manager": E,
    "Store & Procurement Officer": V,
    Auditor: V,
  },
  assets: {
    "Society Admin": V,
    "Operations Manager": E,
    "Store & Procurement Officer": V,
    Auditor: V,
  },
  inventory: {
    "Society Admin": A,
    "Finance Officer": V,
    "Operations Manager": V,
    "Store & Procurement Officer": E,
    Auditor: V,
  },
  procurement: {
    "Society Admin": A,
    "Finance Officer": V,
    "Operations Manager": V,
    "Store & Procurement Officer": E,
    Auditor: V,
  },
  "security-guards": {
    "Society Admin": V,
    "Security Manager": E,
    "Security Guard": V,
    Receptionist: V,
    Auditor: V,
  },
  "security-vehicles": {
    "Society Admin": V,
    "Security Manager": E,
    "Security Guard": V,
    Receptionist: V,
    Auditor: V,
  },
  visitors: {
    "Society Admin": V,
    "Security Manager": E,
    "Security Guard": E,
    Receptionist: E,
    Auditor: V,
  },
  appointments: {
    "Society Admin": V,
    "Operations Manager": V,
    Receptionist: E,
    Auditor: V,
  },
  hr: {
    "Society Admin": V,
    "HR Officer": E,
    Auditor: V,
  },
  "hr-payroll": {
    "Society Admin": A,
    "Finance Officer": () => pack({ view: true, edit: true }), // mark paid
    "HR Officer": E, // prepare
    Auditor: V,
  },
  notices: {
    "Society Admin": () =>
      pack({ view: true, create: true, edit: true, approve: true, delete: true, print: true }),
    "Property Officer": V,
    "Finance Officer": V,
    "Operations Manager": V,
    "Security Manager": V,
    "Security Guard": V,
    "HR Officer": V,
    "Store & Procurement Officer": V,
    Receptionist: DRAFT,
    Auditor: V,
  },
  reports: {
    "Society Admin": ALL_REPORTS,
    "Property Officer": V,
    "Finance Officer": V_EXPORT,
    "Operations Manager": V,
    "Security Manager": V,
    "HR Officer": V,
    "Store & Procurement Officer": V,
    Auditor: ALL_REPORTS,
  },
  "users-roles": {
    "Society Admin": E,
    Auditor: V,
  },
  settings: {
    "Society Admin": E,
    Auditor: V,
  },
  audit: {
    "Society Admin": V,
    Auditor: V,
  },
  invoices: {
    "Society Admin": V,
    "Property Officer": V,
    "Finance Officer": V,
    Auditor: V,
  },
  documents: {
    "Society Admin": ADMIN_MODULE,
    "Property Officer": E,
    "Finance Officer": V,
    Receptionist: V,
    Auditor: V,
  },
};

/** Modules kept internal — not shown on Access Control grid. */
const HIDDEN_ACCESS_CONTROL_KEYS = ["dealers", "finance-gl"];

/** Modules whose create action unlocks member/plot lookup APIs. */
const LOOKUP_PICKER_MODULES = [
  "bookings",
  "payments",
  "complaints",
  "visitors",
  "transfers",
  "nocs",
  "possession",
  "construction",
  "appointments",
  "security-vehicles",
  "refunds",
  "plot-merge",
  "buyback",
];

function expectedForRole(roleName) {
  const out = {};
  for (const [moduleKey, byRole] of Object.entries(MATRIX)) {
    const factory = byRole[roleName];
    out[moduleKey] = factory ? factory() : NONE();
  }
  return out;
}

function fingerprintGrants(grantsByModule) {
  const keys = Object.keys(grantsByModule).sort();
  const normalized = keys.map((key) => {
    const g = grantsByModule[key];
    const actions = ACTIONS.map((a) => (g.actions?.[a] ? a : null)).filter(Boolean);
    return `${key}:${g.isVisible ? 1 : 0}:${actions.join(",")}`;
  });
  return normalized.join("|");
}

function fingerprintFromRecords(modules, records) {
  const byModuleId = new Map(records.map((r) => [r.moduleId, r]));
  const grants = {};
  for (const module of modules) {
    if (HIDDEN_ACCESS_CONTROL_KEYS.includes(module.key)) continue;
    if (!MATRIX[module.key]) continue;
    const record = byModuleId.get(module.id);
    grants[module.key] = {
      isVisible: record?.isVisible === true,
      actions: { ...blank(), ...(record?.actions || {}) },
    };
  }
  return fingerprintGrants(grants);
}

function isLegacyEmpty(modules, records) {
  if (!records.length) return true;
  return records.every((r) => {
    if (r.isVisible !== true) return true;
    const actions = r.actions || {};
    return !ACTIONS.some((a) => actions[a] === true);
  });
}

module.exports = {
  ACTIONS,
  ROLE_NAMES,
  MATRIX,
  HIDDEN_ACCESS_CONTROL_KEYS,
  LOOKUP_PICKER_MODULES,
  expectedForRole,
  fingerprintGrants,
  fingerprintFromRecords,
  isLegacyEmpty,
  NONE,
  V,
  E,
  A,
  EA,
  ADMIN_E,
};
