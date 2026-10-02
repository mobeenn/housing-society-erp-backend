/**
 * Model <-> table metadata, read from the generated Prisma client.
 *
 * The generated DMMF in Prisma 7 exposes only {name, kind, type} it omits
 * `isRequired` and the @@map() target so the table name is recovered by
 * parsing the generated schema.prisma.
 */
const fs = require("fs");
const path = require("path");
const { Prisma } = require("../generated/prisma/client");

const SCALAR_FIELDS = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, m.fields.filter((f) => f.kind === "scalar")])
);

function loadModelTableMap() {
  const schemaPath = path.resolve(__dirname, "../generated/prisma/schema.prisma");
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

/**
 * ModelName -> Map<scalarFkColumn, relationFieldName>
 *
 * Prisma rejects `create({ data: { userId } })` when the model also declares a
 * relation: it selects the *checked* input, which excludes raw FK columns
 * ("Unknown argument `userId`. Did you mean `user`?"). The adapter therefore
 * rewrites scalar FK writes into `{ connect: { id } }`.
 *
 * The DMMF does not expose this mapping, so it is parsed from the schema text:
 *   createdBy  User?  @relation("X", fields: [createdById], references: [id])
 */
function loadForeignKeys() {
  const schemaPath = path.resolve(__dirname, "../generated/prisma/schema.prisma");
  const src = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
  const byModel = new Map();

  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let model;
  while ((model = modelRe.exec(src))) {
    const body = model[2];
    const fks = new Map();
    // relationField  Type  @relation("Name", fields: [fkColumn], references: [..])
    const relRe = /(\w+)\s+[\w]+\??\s+@relation\([^)]*fields:\s*\[\s*(\w+)\s*\][^)]*\)/g;
    let rel;
    while ((rel = relRe.exec(body))) {
      fks.set(rel[2], rel[1]);
    }
    byModel.set(model[1], fks);
  }
  return byModel;
}

const FOREIGN_KEYS = loadForeignKeys();

/**
 * ModelName -> Set<fieldName> of `@updatedAt` columns.
 *
 * Prisma manages these automatically and *rejects* them in the create input
 * ("Unknown argument `updatedAt`") whenever the model's create input is the
 * checked variant. The adapter must therefore never write them by hand.
 */
function loadManagedTimestamps() {
  const schemaPath = path.resolve(__dirname, "../generated/prisma/schema.prisma");
  const src = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
  const byModel = new Map();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let model;
  while ((model = modelRe.exec(src))) {
    const managed = new Set();
    for (const line of model[2].split("\n")) {
      const m = line.match(/^\s*(\w+)\s+\w+.*@updatedAt/);
      if (m) managed.add(m[1]);
    }
    byModel.set(model[1], managed);
  }
  return byModel;
}

const MANAGED_TIMESTAMPS = loadManagedTimestamps();

/**
 * ModelName -> [{ relation, column }]
 *
 * The legacy fileDB stored cross-document references as plain id strings under
 * the related name (e.g. `user.createdBy = "<userId>"`). Prisma models those
 * same links as relations plus a scalar FK column. The adapter bridges the two
 * so the services need no change: relations read back as their id string, and
 * an id string written under the relation name is accepted.
 */
const RELATIONS = new Map(
  [...FOREIGN_KEYS].map(([model, fks]) => [
    model,
    [...fks].map(([column, relation]) => ({ column, relation })),
  ])
);

/** ModelName -> Map<fieldName, prismaType> */
const FIELD_TYPES = new Map(
  [...SCALAR_FIELDS].map(([name, fields]) => [name, new Map(fields.map((f) => [f.name, f.type]))])
);

/**
 * ModelName -> Set<nullable FK column>
 *
 * The fileDB happily stored references to documents that no longer existed
 * (a deleted user, a purged record). Postgres enforces the FK, so a write that
 * connects to a missing row would fail. For these optional columns the adapter
 * degrades to NULL instead of failing, which matches legacy behaviour.
 */
function loadNullableForeignKeys() {
  const schemaPath = path.resolve(__dirname, "../generated/prisma/schema.prisma");
  const src = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
  const byModel = new Map();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let model;
  while ((model = modelRe.exec(src))) {
    const nullable = new Set();
    for (const line of model[2].split("\n")) {
      // e.g.   userId   String?
      const m = line.match(/^\s*(\w+)\s+(String|Int|BigInt)\?/);
      if (m) nullable.add(m[1]);
    }
    byModel.set(model[1], nullable);
  }
  return byModel;
}

const NULLABLE_FKS = loadNullableForeignKeys();

module.exports = {
  SCALAR_FIELDS,
  MODEL_TABLE,
  FIELD_TYPES,
  FOREIGN_KEYS,
  MANAGED_TIMESTAMPS,
  RELATIONS,
  NULLABLE_FKS,
};
