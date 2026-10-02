/**
 * Prisma-backed implementation of the legacy fileDB `collection()` interface.
 *
 * WHY THIS EXISTS
 * ---------------
 * The services in src/modules/* are written against a Mongo-shaped collection
 * API (find/findOne/insertOne/updateOne/aggregate) and, critically, expect:
 *   - documents keyed by `_id`
 *   - timestamps as ISO **strings** (they compare them with < and .slice())
 *   - money as JS **numbers** (they call Number(x) and JSON-serialise directly)
 *
 * Rather than rewrite ~35 service modules and risk behavioural drift, this
 * adapter presents the same interface on top of Prisma/Postgres and translates
 * at the boundary. Services stay untouched; the datastore becomes Postgres.
 *
 * Translation rules
 *   write: ISO string -> Date for DateTime columns, number -> Decimal
 *   read:  Date -> ISO string, Decimal -> number, id -> _id
 *   The read direction is what keeps every API response byte-identical.
 */
const crypto = require("crypto");
const { prisma } = require("../config/prisma");
const { Prisma } = require("../generated/prisma/client");
const {
  MODEL_TABLE,
  FIELD_TYPES,
  FOREIGN_KEYS,
  MANAGED_TIMESTAMPS,
  RELATIONS,
  NULLABLE_FKS,
} = require("./prismaMeta");

const Decimal = Prisma.Decimal;

// When true, writing a field the table does not have throws instead of being
// silently dropped. Used to prove the schema covers every model during the
// migration; left off in normal operation.
let STRICT_FIELDS = process.env.PRISMADB_STRICT_FIELDS === "true";
const setStrictFields = (value) => {
  STRICT_FIELDS = Boolean(value);
};

/** Legacy collection name -> Prisma model name. */
const COLLECTION_MODEL = {
  members: "Member",
  plots: "Plot",
  ownershipHistory: "OwnershipHistory",
  bookings: "Booking",
  installmentPlans: "InstallmentPlan",
  installments: "Installment",
  payments: "Payment",
  refunds: "Refund",
  expenses: "Expense",
  vendors: "Vendor",
  purchaseRequests: "PurchaseRequest",
  quotations: "Quotation",
  purchaseOrders: "PurchaseOrder",
  goodsReceivedNotes: "Grn",
  inventoryItems: "InventoryItem",
  stockTransactions: "StockTransaction",
  transferRequests: "TransferRequest",
  nocApplications: "NocApplication",
  possessionApplications: "PossessionApplication",
  constructionApplications: "ConstructionApplication",
  siteInspections: "SiteInspection",
  complaints: "Complaint",
  assets: "Asset",
  workOrders: "WorkOrder",
  employees: "Employee",
  attendance: "Attendance",
  leaveRequests: "LeaveRequest",
  guards: "Guard",
  dutyRoster: "DutyRoster",
  vehicles: "Vehicle",
  passes: "Pass",
  blacklist: "BlacklistEntry",
  visitorEntries: "VisitorEntry",
  notices: "Notice",
  notifications: "Notification",
  documents: "Document",
  invoices: "Invoice",
  recoveryAssignments: "RecoveryAssignment",
  recoveryCalls: "RecoveryCall",
  hrSetups: "HrSetup",
  loans: "Loan",
  payrollRuns: "PayrollRun",
  journalEntries: "JournalEntry",
  appointments: "Appointment",
  registryBatches: "RegistryBatch",
  plotMerges: "PlotMerge",
  buybacks: "Buyback",
  // identity / administration (used by the not-yet-rewritten legacy models)
  users: "User",
  roles: "Role",
  rbacModules: "RbacModule",
  roleModuleAccess: "RoleModuleAccess",
  auditLogs: "AuditLog",
  numberingRules: "NumberingRule",
  societySettings: "SocietySettings",
  departments: "Department",
  blocks: "Block",
  streets: "Street",
  plotCategories: "PlotCategory",
  propertyTypes: "PropertyType",
  nocTypes: "NocType",
  masterData: "MasterData",
};

/** Prisma model name -> the camelCase delegate name on the client. */
const camel = (modelName) => modelName.charAt(0).toLowerCase() + modelName.slice(1);

const newId = () => crypto.randomBytes(12).toString("hex");

// value coercion 

const toDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDecimal = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Decimal) return value;
  const n = Number(value);
  return Number.isFinite(n) ? new Decimal(n) : null;
};

/** Decimal -> number, so JSON responses keep emitting numbers, not strings. */
const fromDecimal = (value) => (value === null || value === undefined ? null : Number(value));

// query translation 

const OPERATORS = {
  $eq: (v) => ({ equals: v }),
  $ne: (v) => ({ not: v }),
  $gt: (v) => ({ gt: v }),
  $gte: (v) => ({ gte: v }),
  $lt: (v) => ({ lt: v }),
  $lte: (v) => ({ lte: v }),
  // The fileDB tolerated `undefined` inside $in (it simply never matched).
  // Prisma rejects it, so drop those entries; an empty list matches nothing,
  // which is the same outcome.
  $in: (v) => ({ in: (Array.isArray(v) ? v : [v]).filter((x) => x !== undefined) }),
  $nin: (v) => ({ notIn: (Array.isArray(v) ? v : [v]).filter((x) => x !== undefined) }),
};

/**
 * Reproduce the legacy matcher for a field that does not exist on the table.
 *
 * The fileDB resolved unknown fields to `undefined`, so:
 *   { missing: { $ne: "Paid" } }  ->  undefined !== "Paid"  ->  TRUE  (matches all)
 *   { missing: "Paid" }           ->  undefined === "Paid"  ->  FALSE (matches none)
 *   { missing: { $in: [...] } }   ->  never included       ->  FALSE
 *   { missing: { $gt: x } }       ->  undefined > x        ->  FALSE
 *
 * Rather than erroring (which would break endpoints that relied on this),
 * the query is reduced to the same result. `true` means "matches every row".
 */
const unknownFieldMatches = (clause) => {
  if (clause === null) return true; // undefined === null -> false, but keep it simple
  if (clause && typeof clause === "object" && !Array.isArray(clause)) {
    if ("$ne" in clause) return true; // undefined !== anything
    if ("$nin" in clause) return true;
    if ("$not" in clause) return true;
    return false; // equality, $in, $gt, $gte, $lt, $lte, $regex on undefined
  }
  return false; // strict equality against undefined
};

/** A Prisma clause that matches no rows. */
const matchesNothing = (fieldTypes) => {
  const anchor = fieldTypes.has("id") ? "id" : [...fieldTypes.keys()][0];
  return anchor ? { [anchor]: { in: [] } } : { id: { in: [] } };
};

/**
 * Translate a legacy Mongo-subset query into a Prisma `where`.
 * Supported: implicit equality, $eq $ne $gt $gte $lt $lte $in $nin,
 *            $regex (+$options), $or, $and, $not.
 */
function toPrismaWhere(query, fieldTypes) {
  if (!query || typeof query !== "object") return {};

  const where = {};
  for (const [rawKey, rawValue] of Object.entries(query)) {
    // Logical operators first
    if (rawKey === "$or") {
      where.OR = rawValue.map((q) => toPrismaWhere(q, fieldTypes));
      continue;
    }
    if (rawKey === "$and") {
      where.AND = rawValue.map((q) => toPrismaWhere(q, fieldTypes));
      continue;
    }
    if (rawKey === "$not") {
      where.NOT = toPrismaWhere(rawValue, fieldTypes);
      continue;
    }

    const key = rawKey === "_id" ? "id" : rawKey;
    const type = fieldTypes.get(key);

    if (type === undefined) {
      // The column does not exist. Reproduce legacy behaviour instead of
      // failing the request.
      if (unknownFieldMatches(rawValue)) continue;
      Object.assign(where, matchesNothing(fieldTypes));
      continue;
    }

    if (rawValue === null) {
      where[key] = { equals: null };
      continue;
    }

    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      const isOperatorObject = Object.keys(rawValue).some((k) => k.startsWith("$"));

      if (isOperatorObject) {
        if (rawValue.$regex !== undefined) {
          // Legacy regex: only the case-insensitive "contains" form is used.
          const flags = String(rawValue.$options || "").includes("i") ? "i" : "";
          const pattern = escapeRegex(String(rawValue.$regex));
          where[key] = {
            ...(flags ? { mode: "insensitive" } : {}),
            contains: pattern,
          };
          continue;
        }
        const clause = {};
        for (const [op, operand] of Object.entries(rawValue)) {
          if (op === "$options") continue;
          const build = OPERATORS[op];
          if (build) Object.assign(clause, build(coerceOperand(operand, type)));
        }
        if (Object.keys(clause).length) where[key] = clause;
        continue;
      }

 // Plain nested object equality (e.g. approval stage matching) compare
      // as JSON so Prisma can match a document-valued column.
      where[key] = { equals: rawValue };
      continue;
    }

    where[key] = coerceOperand(rawValue, type);
  }
  return where;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function coerceOperand(value, type) {
  if (value === undefined) return null;
  if (type === "DateTime") return toDate(value);
  if (type === "Decimal") return toDecimal(value);
  return value;
}

// document <-> row 

/** Prisma row -> legacy document (`_id`, ISO dates, numeric decimals). */
function toDocument(row, fieldTypes, collection) {
  if (row === null || row === undefined) return null;
  const doc = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      doc[key] = null;
      continue;
    }
    const type = fieldTypes.get(key);
    if (type === "DateTime" && value instanceof Date) doc[key] = value.toISOString();
    else if (type === "Decimal") doc[key] = fromDecimal(value);
    else doc[key] = value;
  }
  doc._id = doc.id;

  // Expose relations under the legacy name as the referenced id, because the
  // fileDB kept cross-document links as plain id strings (user.createdBy).
  if (collection) {
    for (const { column, relation } of RELATIONS.get(modelNameFor(collection)) || []) {
      if (doc[relation] === undefined && doc[column] !== undefined) {
        doc[relation] = doc[column];
      }
    }
  }
  return doc;
}

const toDocuments = (rows, fieldTypes, collection) =>
  rows.map((r) => toDocument(r, fieldTypes, collection));

/** Legacy document -> Prisma write payload. */
function toWriteData(doc, fieldTypes, collection, isCreate = false) {
  const data = {};
  const relations = RELATIONS.get(modelNameFor(collection)) || [];

  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id") {
      if (value !== undefined && value !== null) data.id = value;
      continue;
    }
    if (key === "id") {
      data.id = value;
      continue;
    }
    if (value === undefined) continue;

    // Relations are checked first: a relation is not a scalar column, so it
    // would otherwise be reported as an unknown field. The legacy shape passes
    // a plain id string here (user.createdBy = "<userId>"); connectForeignKeys
    // turns the moved value into a connect.
    const asRelation = relations.find((r) => r.relation === key);
    if (asRelation) {
      if (typeof value === "string" || value === null) data[asRelation.column] = value;
      else data[asRelation.relation] = value; // already a nested {connect}/object
      continue;
    }

    const type = fieldTypes.get(key);
    if (!type) {
      if (STRICT_FIELDS) {
        throw new Error(
          `[prismaCollection] "${collection}" has no column "${key}". ` +
            `Add it to the Prisma model (table ${MODEL_TABLE.get(camel(modelNameFor(collection))) || "?"}).`
        );
      }
      continue; // column does not exist -> drop, as the import script does
    }

    if (type === "DateTime") {
      data[key] = toDate(value);
    } else if (type === "Decimal") {
      data[key] = toDecimal(value);
    } else {
      data[key] = value;
    }
  }
  return connectForeignKeys(data, collection, isCreate);
}

/** Drop `@updatedAt` columns Prisma sets those itself and rejects them on write. */
function dropManagedTimestamps(data, collection) {
  const managed = MANAGED_TIMESTAMPS.get(modelNameFor(collection));
  if (!managed) return data;
  for (const field of managed) delete data[field];
  return data;
}

/**
 * Run a write, degrading unresolvable optional references to NULL.
 *
 * Postgres enforces foreign keys; the fileDB did not, so the legacy data (and
 * the current services) can point at a user/record that has since been deleted.
 * On P2025 we retry with every optional connect replaced by NULL, which keeps
 * the row writable instead of failing the whole request.
 */
async function withFkFallback(operation, data, collection) {
  try {
    return await operation();
  } catch (error) {
    if (error?.code !== "P2025") throw error;
    const relations = RELATIONS.get(modelNameFor(collection)) || [];
    const nullable = NULLABLE_FKS.get(modelNameFor(collection)) || new Set();
    let relaxed = false;
    for (const { column, relation } of relations) {
      if (!nullable.has(column)) continue;
      if (data[relation] === undefined) continue;
      delete data[relation];
      relaxed = true;
    }
    if (!relaxed) throw error;
    return operation();
  }
}

const modelNameFor = (collection) => {
  if (!COLLECTION_MODEL[collection]) {
    throw new Error(`[prismaCollection] No Prisma model mapped for collection "${collection}"`);
  }
  return COLLECTION_MODEL[collection];
};

/**
 * Rewrite scalar FK writes into relation connects, because Prisma's checked
 * create/update input omits FK columns when the model also declares relations.
 *   { userId: "x" }  ->  { user: { connect: { id: "x" } } }
 * A null FK becomes an explicit disconnect so a cleared reference is written.
 */
function connectForeignKeys(data, collection, isCreate = false) {
  const fks = FOREIGN_KEYS.get(modelNameFor(collection));
  if (!fks) return data;
  for (const [column, relation] of fks) {
    if (data[relation] !== undefined) continue; // caller set it explicitly
    const value = data[column];
    if (value === undefined) continue;
    delete data[column];
    if (value === null) {
      // On create, simply omit the relation: Prisma's create input for an
      // optional to-one relation accepts connect/create but not `disconnect`.
      // On update, an explicit null means "clear the reference".
      if (!isCreate) data[relation] = { disconnect: true };
      continue;
    }
    data[relation] = { connect: { id: value } };
  }
  return data;
}

// in-memory aggregation (mirrors fileDb exactly) 

function matchQuery(doc, query) {
  return Object.entries(query || {}).every(([key, value]) => {
    const docValue = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), doc);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.$in && !value.$in.includes(docValue)) return false;
      if (value.$ne !== undefined && docValue === value.$ne) return false;
      if (value.$gt !== undefined && !(docValue > value.$gt)) return false;
      if (value.$gte !== undefined && !(docValue >= value.$gte)) return false;
      if (value.$lt !== undefined && !(docValue < value.$lt)) return false;
      if (value.$lte !== undefined && !(docValue <= value.$lte)) return false;
      if (value.$regex !== undefined) {
        const re = new RegExp(String(value.$regex), String(value.$options || ""));
        return typeof docValue === "string" && re.test(docValue);
      }
      return true;
    }
    return docValue === value;
  });
}

const evalExpr = (doc, expr) => {
  if (expr === 1) return 1;
  if (typeof expr === "string" && expr.startsWith("$")) {
    return doc[expr.slice(1)];
  }
  if (expr && typeof expr === "object") {
    if (expr.$dateToString) {
      const d = new Date(doc[expr.$dateToString.date.slice(1)]);
      if (Number.isNaN(d.getTime())) return null;
      const parts = {
        "%Y": String(d.getUTCFullYear()),
        "%m": String(d.getUTCMonth() + 1).padStart(2, "0"),
        "%d": String(d.getUTCDate()).padStart(2, "0"),
        "%Y-%m": `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        "%Y-%m-%d": `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
          d.getUTCDate()
        ).padStart(2, "0")}`,
      };
      return parts[expr.$dateToString.format] ?? null;
    }
    return evalExpr(doc, expr);
  }
  return expr;
};

/** Aggregate over Postgres rows, reproducing fileDb's $match/$group/$sort/$project. */
async function aggregate(collection, pipeline = []) {
  const meta = resolve(collection);
  const rows = await meta.delegate.findMany();
  let results = rows.map((r) => toDocument(r, meta.fieldTypes));

  for (const stage of pipeline) {
    if (stage.$match) results = results.filter((doc) => matchQuery(doc, stage.$match));
    if (stage.$group) {
      const groups = new Map();
      for (const doc of results) {
        const key = JSON.stringify(evalExpr(doc, stage.$group._id));
        if (!groups.has(key)) groups.set(key, { _id: evalExpr(doc, stage.$group._id) });
        const group = groups.get(key);
        for (const [field, acc] of Object.entries(stage.$group)) {
          if (field === "_id") continue;
          if (acc.$sum !== undefined) {
            group[field] =
              (group[field] || 0) + (acc.$sum === 1 ? 1 : Number(evalExpr(doc, acc.$sum) || 0));
          }
          if (acc.$count) group[field] = (group[field] || 0) + 1;
        }
      }
      results = Array.from(groups.values());
    }
    if (stage.$sort) {
      const [[field, order]] = Object.entries(stage.$sort);
      results.sort((a, b) => (order === 1 ? (a[field] > b[field] ? 1 : -1) : a[field] < b[field] ? 1 : -1));
    }
    if (stage.$project) {
      results = results.map((doc) =>
        Object.fromEntries(
          Object.entries(stage.$project)
            .filter(([, include]) => include)
            .map(([field]) => [field, doc[field]])
        )
      );
    }
  }
  return results;
}

// the collection object 

const cache = new Map();

function resolve(collection) {
  if (cache.has(collection)) return cache.get(collection);
  const modelName = COLLECTION_MODEL[collection];
  if (!modelName) {
    throw new Error(
      `[prismaCollection] No Prisma model mapped for collection "${collection}". ` +
        `Add it to COLLECTION_MODEL in src/db/prismaCollection.js.`
    );
  }
  const delegate = prisma[camel(modelName)];
  const fieldTypes = FIELD_TYPES.get(modelName) || new Map();
  const meta = { collection, modelName, delegate, fieldTypes, table: MODEL_TABLE.get(modelName) };
  cache.set(collection, meta);
  return meta;
}

function collection(name) {
  const meta = resolve(name);
  const { delegate, fieldTypes } = meta;

  return {
    collectionName: name,

    async findOne(query = {}) {
      const row = await delegate.findFirst({ where: toPrismaWhere(query, fieldTypes) });
      return toDocument(row, fieldTypes, name);
    },

    async find(query = {}, options = {}) {
      const where = toPrismaWhere(query, fieldTypes);
      const args = { where };
      if (options.sort) {
        const entries = Object.entries(options.sort);
        args.orderBy = entries.map(([field, order]) => ({
          [field === "_id" ? "id" : field]: order === 1 ? "asc" : "desc",
        }));
      }
      if (options.skip) args.skip = options.skip;
      if (options.limit) args.take = options.limit;
      if (options.select) {
        const pick = {};
        for (const [field, want] of Object.entries(options.select)) {
          const column = field === "_id" ? "id" : field;
          // A projection may name a column the table does not have; the fileDB
          // simply projected undefined. Skip it rather than failing.
          if (want && fieldTypes.has(column)) pick[column] = true;
        }
        args.select = { ...pick, id: true };
      }
      const rows = await delegate.findMany(args);
      if (options.select) {
        return rows.map((row) => {
          const doc = toDocument(row, fieldTypes, name);
          for (const key of Object.keys(doc)) {
            if (key === "_id" || key === "id") continue;
            if (!options.select[key]) delete doc[key];
          }
          return doc;
        });
      }
      return toDocuments(rows, fieldTypes, name);
    },

    async findOneAndUpdate(query, update, options = {}) {
      const where = toPrismaWhere(query, fieldTypes);
      const before = await delegate.findFirst({ where });
      if (!before) return null;
      const data = dropManagedTimestamps(toWriteData(update.$set || update, fieldTypes, name), name);
      await withFkFallback(() => delegate.update({ where: { id: before.id }, data }), data, name);
      if (options.returnDocument === "before") return toDocument(before, fieldTypes, name);
      const after = await delegate.findUnique({ where: { id: before.id } });
      return toDocument(after, fieldTypes, name);
    },

    aggregate: (pipeline) => aggregate(name, pipeline),

    async countDocuments(query = {}) {
      return delegate.count({ where: toPrismaWhere(query, fieldTypes) });
    },

    count(query = {}) {
      return delegate.count({ where: toPrismaWhere(query, fieldTypes) });
    },

    async insertOne(document) {
      const data = toWriteData(document, fieldTypes, name, true);
      if (!data.id) data.id = newId();
      // Only stamp columns the table actually has. @updatedAt columns are
      // Prisma's to set and are dropped below.
      if (fieldTypes.has("createdAt") && !data.createdAt) data.createdAt = new Date();
      dropManagedTimestamps(data, name);
      const created = await withFkFallback(() => delegate.create({ data }), data, name);
      const doc = toDocument(created, fieldTypes, name);
      return { insertedId: created.id, ...doc };
    },

    async insertMany(documents) {
      const out = [];
      for (const document of documents) out.push(await this.insertOne(document));
      return out;
    },

    async updateOne(query, update) {
      const where = toPrismaWhere(query, fieldTypes);
      const existing = await delegate.findFirst({ where });
      if (!existing) return { matchedCount: 0, modifiedCount: 0 };
      const data = dropManagedTimestamps(toWriteData(update.$set || update, fieldTypes, name), name);
      await withFkFallback(() => delegate.update({ where: { id: existing.id }, data }), data, name);
      return { matchedCount: 1, modifiedCount: 1 };
    },

    async updateMany(query, update) {
      const where = toPrismaWhere(query, fieldTypes);
      const rows = await delegate.findMany({ where, select: { id: true } });
      const data = dropManagedTimestamps(toWriteData(update.$set || update, fieldTypes, name), name);
      for (const row of rows) {
        await withFkFallback(() => delegate.update({ where: { id: row.id }, data }), { ...data }, name);
      }
      return { matchedCount: rows.length, modifiedCount: rows.length };
    },

    async deleteOne(query) {
      const where = toPrismaWhere(query, fieldTypes);
      const existing = await delegate.findFirst({ where });
      if (!existing) return { deletedCount: 0 };
      await delegate.delete({ where: { id: existing.id } });
      return { deletedCount: 1 };
    },

    async deleteMany(query = {}) {
      const where = toPrismaWhere(query, fieldTypes);
      const { count } = await delegate.deleteMany({ where });
      return { deletedCount: count };
    },
  };
}

module.exports = {
  collection,
  COLLECTION_MODEL,
  camel,
  setStrictFields,
  /** Prisma delegate for a legacy collection name (used by maintenance scripts). */
  delegateForCollection: (collectionName) => resolve(collectionName).delegate,
  /** Prisma model name for a legacy collection name. */
  modelNameForCollection: (collectionName) => {
    if (!COLLECTION_MODEL[collectionName]) {
      throw new Error(`No Prisma model mapped for collection "${collectionName}"`);
    }
    return COLLECTION_MODEL[collectionName];
  },
};
