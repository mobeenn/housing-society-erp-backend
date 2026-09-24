const { db } = require("../../config/db");
const Role = require("../auth/role.model");
const Module = require("./module.model");
const { RoleModuleAccess, ACTIONS, defaultActions } = require("./access.model");
const ApiError = require("../../utils/ApiError");

const RBAC_MIGRATION_VERSION = "dynamic-rbac-v3";

const legacyModuleByPrefix = {
  members: "members",
  plots: "plots",
  bookings: "bookings",
  installments: "installments",
  payments: "payments",
  refunds: "refunds",
  expenses: "expenses",
  transfers: "transfers",
  nocs: "nocs",
  possession: "possession",
  construction: "construction",
  complaints: "complaints",
  maintenance: "maintenance",
  assets: "assets",
  security: "security-guards",
  visitors: "visitors",
  vehicles: "security-vehicles",
  staff: "hr",
  inventory: "inventory",
  procurement: "procurement",
  reports: "reports",
  settings: "settings",
  users: "users-roles",
  roles: "users-roles",
  audit: "audit",
  invoices: "invoices",
  documents: "documents",
  recovery: "recovery",
  "hr-payroll": "hr-payroll",
  "plot-merge": "plot-merge",
  buyback: "buyback",
  registry: "registry",
  appointments: "appointments",
  notices: "notices",
  dashboards: "dashboards",
};

function legacyPermissionToModuleAction(permission) {
  if (!permission || typeof permission !== "string") return null;
  if (permission === "system:admin") return null;
  if (permission === "refunds:pay") return { module: "refunds", action: "refund" };
  const [prefix, rawAction] = permission.split(":");
  const module = legacyModuleByPrefix[prefix];
  if (!module || !rawAction) return null;
  const actionMap = {
    view: "view",
    create: "create",
    edit: "edit",
    update: "edit",
    manage: "edit",
    assign: "edit",
    resolve: "edit",
    pay: "edit",
    change: "edit",
    manage_payroll: "edit",
    reconcile: "edit",
    override_dues: "edit",
    review: "edit",
    inspect: "edit",
    delete: "delete",
    approve: "approve",
    verify: "approve",
    issue: "approve",
    complete: "approve",
    reject: "reject",
    cancel: "cancel",
    print: "print",
    export: "export",
    refund: "refund",
    financial: "view",
  };
  return { module, action: actionMap[rawAction] || "edit" };
}

function legacyPermissionToModuleActions(permission) {
  const primary = legacyPermissionToModuleAction(permission);
  if (!primary) return [];
  const moduleAliases = {
    "staff:manage_payroll": [{ module: "hr-payroll", action: "edit" }],
  };
  const actionAliases = {
    "bookings:approve": ["reject"],
    "bookings:edit": ["cancel"],
    "construction:approve": ["reject"],
    "expenses:approve": ["reject"],
    "maintenance:edit": ["cancel"],
    "notices:manage": ["delete"],
    "refunds:approve": ["reject"],
    "transfers:approve": ["reject"],
  };
  return [
    primary,
    ...(moduleAliases[permission] || []),
    ...(actionAliases[permission] || []).map((action) => ({ module: primary.module, action })),
  ];
}

class RbacService {
  static roleIds(user) {
    return [...new Set([
      ...(user?.roles || []).map((role) => (typeof role === "object" ? role._id : role)).filter(Boolean),
      user?.roleId,
      typeof user?.role === "object" ? user.role._id : user?.role,
    ].filter(Boolean))];
  }

  static isSuperAdmin(user) {
    const roles = [...(user?.roles || []), user?.role].filter(Boolean);
    return roles.some((role) => typeof role === "object" && (
      role.name === "Super Admin" || role.permissions?.includes("system:admin")
    ));
  }

  static dashboardTypeForUser(user) {
    const names = [...(user?.roles || []), user?.role]
      .filter((role) => role && typeof role === "object")
      .map((role) => role.name);
    if (names.some((name) => ["Finance Officer", "Auditor"].includes(name))) return "finance";
    if (names.some((name) => ["Operations Manager", "HR Officer"].includes(name))) return "operations";
    if (names.some((name) => ["Security Manager", "Security Guard", "Receptionist"].includes(name))) return "security";
    if (names.includes("Property Officer")) return "property";
    return "management";
  }

  static async registryModules() {
    return Module.find({}, { sort: { sortOrder: 1 } });
  }

  static async activeModules() {
    return Module.find({ isActive: true }, { sort: { sortOrder: 1 } });
  }

  static async catalog() {
    const modules = await this.registryModules();
    return {
      actions: ACTIONS,
      modules: modules.map((module) => ({
        key: module.key,
        label: module.label,
        description: module.description,
        group: module.group,
        icon: module.icon,
        route: module.route,
        sortOrder: module.sortOrder,
        isActive: module.isActive,
        showInSidebar: module.showInSidebar !== false,
      })),
    };
  }

  static async getMyAccess(user) {
    const modules = await this.activeModules();
    if (this.isSuperAdmin(user)) {
      return {
        userId: user._id,
        roleIds: this.roleIds(user),
        isSuperAdmin: true,
        dashboardType: this.dashboardTypeForUser(user),
        generatedAt: new Date().toISOString(),
        modules: modules.map((module) => ({
          key: module.key,
          label: module.label,
          description: module.description,
          group: module.group,
          icon: module.icon,
          route: module.route,
          showInSidebar: module.showInSidebar !== false,
          sortOrder: module.sortOrder,
          isActive: module.isActive,
          isVisible: true,
          actions: Object.fromEntries(ACTIONS.map((action) => [action, true])),
        })),
      };
    }

    const roleIds = this.roleIds(user);
    const records = await RoleModuleAccess.find({});
    const byModule = new Map();
    records.filter((record) => roleIds.includes(record.role) && record.isVisible).forEach((record) => {
      const current = byModule.get(record.module) || defaultActions();
      ACTIONS.forEach((action) => { current[action] = current[action] || record.actions?.[action] === true; });
      byModule.set(record.module, current);
    });

    return {
      userId: user._id,
      roleIds,
      isSuperAdmin: false,
      dashboardType: this.dashboardTypeForUser(user),
      generatedAt: new Date().toISOString(),
      modules: modules.map((module) => ({
        key: module.key,
        label: module.label,
        description: module.description,
        group: module.group,
        icon: module.icon,
        route: module.route,
        sortOrder: module.sortOrder,
        isActive: module.isActive,
        isVisible: byModule.has(module._id),
        actions: byModule.get(module._id) || defaultActions(),
      })),
    };
  }

  static async getRoleAccessGrid(roleId) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, "Role not found");
    const modules = await this.registryModules();
    if (role.name === "Super Admin" || role.permissions?.includes("system:admin")) {
      return {
        role: { _id: role._id, name: role.name, description: role.description, isSystem: Boolean(role.isSystem || role.isSystemRole), isSystemRole: Boolean(role.isSystemRole) },
        readOnly: true,
        modules: modules.map((module) => ({ ...module, isVisible: true, actions: Object.fromEntries(ACTIONS.map((action) => [action, true])) })),
      };
    }
    const records = await RoleModuleAccess.find({ role: roleId });
    const byModule = new Map(records.map((record) => [record.module, record]));
    return {
      role: { _id: role._id, name: role.name, description: role.description, isSystem: Boolean(role.isSystem || role.isSystemRole), isSystemRole: Boolean(role.isSystemRole) },
      readOnly: false,
      modules: modules.map((module) => {
        const record = byModule.get(module._id);
        return { ...module, isVisible: record?.isVisible === true, actions: record?.actions || defaultActions() };
      }),
    };
  }

  static async updateRoleAccess(roleId, payload, updatedBy) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, "Role not found");
    if (role.name === "Super Admin" || role.permissions?.includes("system:admin")) {
      throw new ApiError(400, "Super Admin access is managed automatically and cannot be changed");
    }
    const updates = Array.isArray(payload) ? payload : payload?.modules;
    if (!Array.isArray(updates)) throw new ApiError(400, "modules must be an array");
    const modules = await this.registryModules();
    const moduleByKey = new Map(modules.map((module) => [module.key, module]));
    const updateByKey = new Map();
    for (const update of updates) {
      if (!update || typeof update !== "object" || !moduleByKey.has(update.key)) {
        throw new ApiError(400, "Every module update must reference a registered module");
      }
      if (typeof update.isVisible !== "boolean" || (update.actions !== undefined && (!update.actions || typeof update.actions !== "object" || Array.isArray(update.actions)))) {
        throw new ApiError(400, `Invalid access payload for module ${update.key}`);
      }
      if (update.actions && Object.keys(update.actions).some((action) => !ACTIONS.includes(action))) {
        throw new ApiError(400, `Unknown action in module ${update.key}`);
      }
      if (updateByKey.has(update.key)) {
        throw new ApiError(400, `Duplicate module update for ${update.key}`);
      }
      updateByKey.set(update.key, update);
    }

    // PUT replaces the complete grid. Missing modules are explicitly reset to
    // hidden so a stale record can never survive a partial UI save.
    for (const module of modules) {
      const update = updateByKey.get(module.key) || { isVisible: false, actions: {} };
      await RoleModuleAccess.upsert(roleId, module._id, {
        isVisible: update.isVisible,
        actions: update.actions || {},
        updatedBy,
      });
    }
    return this.getRoleAccessGrid(roleId);
  }

  static async ensureRoleModuleAccess(roleId) {
    const role = await Role.findById(roleId);
    if (!role) return;
    const [modules, records] = await Promise.all([
      this.registryModules(),
      RoleModuleAccess.find({ role: roleId }),
    ]);
    const existingModuleIds = new Set(records.map((record) => record.module));
    for (const module of modules) {
      if (existingModuleIds.has(module._id)) continue;
      const actions = defaultActions();
      if (role.name === "Super Admin" || role.permissions?.includes("system:admin")) {
        await RoleModuleAccess.upsert(roleId, module._id, {
          isVisible: true,
          actions: Object.fromEntries(ACTIONS.map((action) => [action, true])),
          updatedBy: null,
        });
        continue;
      }
      for (const permission of role.permissions || []) {
        for (const mapped of legacyPermissionToModuleActions(permission)) {
          if (mapped.module === module.key) actions[mapped.action] = true;
        }
      }
      await RoleModuleAccess.upsert(roleId, module._id, {
        isVisible: ACTIONS.some((action) => actions[action]),
        actions,
        updatedBy: null,
      });
    }
  }

  static async migrateLegacyAccess({ force = false } = {}) {
    const [roles, modules] = await Promise.all([Role.find({}), this.registryModules()]);
    const previous = db.data.rbacMigration || {};
    const fingerprints = previous.roleFingerprints || {};
    const currentFingerprints = Object.fromEntries(roles.map((role) => [
      role._id,
      JSON.stringify([...new Set(role.permissions || [])].sort()),
    ]));
    const moduleKeys = modules.map((module) => module.key);
    const moduleSetChanged = JSON.stringify(previous.moduleKeys || []) !== JSON.stringify(moduleKeys);
    const changedRoleIds = roles
      .filter((role) => force || fingerprints[role._id] !== currentFingerprints[role._id])
      .map((role) => role._id);

    if (!force && previous.version === RBAC_MIGRATION_VERSION && !moduleSetChanged && changedRoleIds.length === 0) {
      return { migrated: false, version: previous.version, roleCount: roles.length };
    }

    if (force || previous.version !== RBAC_MIGRATION_VERSION) {
      for (const role of roles) await this.migrateRoleAccess(role._id);
    } else {
      for (const roleId of changedRoleIds) await this.migrateRoleAccess(roleId);
      if (moduleSetChanged) {
        for (const role of roles) await this.ensureRoleModuleAccess(role._id);
      }
    }

    db.data.rbacMigration = {
      version: RBAC_MIGRATION_VERSION,
      migratedAt: new Date().toISOString(),
      moduleCount: modules.length,
      roleCount: roles.length,
      moduleKeys,
      roleFingerprints: currentFingerprints,
    };
    await db.save();
    return {
      migrated: true,
      version: RBAC_MIGRATION_VERSION,
      moduleCount: modules.length,
      roleCount: roles.length,
      changedRoleCount: changedRoleIds.length,
    };
  }

  static async migrateRoleAccess(roleId) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, "Role not found");
    const modules = await this.registryModules();
    const isSuperAdmin = role.name === "Super Admin" || role.permissions?.includes("system:admin");
    for (const module of modules) {
      const actions = defaultActions();
      if (isSuperAdmin) {
        await RoleModuleAccess.upsert(roleId, module._id, {
          isVisible: true,
          actions: Object.fromEntries(ACTIONS.map((action) => [action, true])),
          updatedBy: null,
        });
        continue;
      }
      for (const permission of role.permissions || []) {
        for (const mapped of legacyPermissionToModuleActions(permission)) {
          if (mapped.module === module.key) actions[mapped.action] = true;
        }
      }
      await RoleModuleAccess.upsert(roleId, module._id, {
        isVisible: ACTIONS.some((action) => actions[action]),
        actions,
        updatedBy: null,
      });
    }
    return roleId;
  }

  static async isAllowed(user, moduleKey, action) {
    if (this.isSuperAdmin(user)) return true;
    if (!ACTIONS.includes(action)) return false;
    const modules = await Module.find({ key: moduleKey, isActive: true });
    if (!modules.length) return false;
    const roleIds = this.roleIds(user);
    const records = await RoleModuleAccess.find({ module: modules[0]._id });
    return records.some((record) => roleIds.includes(record.role) && record.isVisible === true && record.actions?.[action] === true);
  }
}

module.exports = RbacService;
module.exports.ACTIONS = ACTIONS;
module.exports.defaultActions = defaultActions;
module.exports.legacyPermissionToModuleAction = legacyPermissionToModuleAction;
module.exports.legacyPermissionToModuleActions = legacyPermissionToModuleActions;
module.exports.RBAC_MIGRATION_VERSION = RBAC_MIGRATION_VERSION;
module.exports.legacyModuleByPrefix = legacyModuleByPrefix;
