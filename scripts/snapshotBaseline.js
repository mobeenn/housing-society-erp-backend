/**
 * Snapshot / restore the canonical row set.
 *
 * The legacy test suite creates rows (vehicles, visitors, complaints, ...).
 * Because tests now run against Postgres, they leave real rows behind. This
 * records the id set that the one-time import produced, so `restore` can delete
 * anything created afterwards and return the database to the migrated state.
 *
 *   node scripts/snapshotBaseline.js save
 *   node scripts/snapshotBaseline.js restore
 */
const fs = require("fs");
const path = require("path");
const { prisma } = require("../src/config/prisma");
const { COLLECTION_MODEL, delegateForCollection } = require("../src/db/prismaCollection");

const MANIFEST = path.resolve(__dirname, "../data/.baseline-ids.json");

// Collections excluded from the manifest: reference/lookup tables and the
// tables the test suite is not expected to pollute in a destructive way.
const EXCLUDE = new Set(["SocietySettings", "MasterData"]);

async function main() {
  const action = process.argv[2] || "save";
  const manifest = {};

  if (action === "save") {
    for (const [collection, modelName] of Object.entries(COLLECTION_MODEL)) {
      if (EXCLUDE.has(modelName)) continue;
      const rows = await delegateForCollection(collection).findMany({ select: { id: true } });
      manifest[modelName] = rows.map((r) => r.id);
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
    const total = Object.values(manifest).reduce((s, a) => s + a.length, 0);
    console.log(`baseline saved: ${Object.keys(manifest).length} tables, ${total} ids -> ${MANIFEST}`);
  } else {
    if (!fs.existsSync(MANIFEST)) throw new Error("No baseline manifest. Run: save");
    const saved = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    let removed = 0;
    for (const [modelName, ids] of Object.entries(saved)) {
      const keep = new Set(ids);
      const rows = await prisma[modelName.toLowerCase()[0]+modelName.slice(1)].findMany({ select: { id: true } });
      const extra = rows.filter((r) => !keep.has(r.id)).map((r) => r.id);
      if (!extra.length) continue;
      await prisma[modelName.toLowerCase()[0]+modelName.slice(1)].deleteMany({ where: { id: { in: extra } } });
      removed += extra.length;
      console.log(`   ${modelName}: removed ${extra.length} row(s) created after the baseline`);
    }
    console.log(`baseline restored: ${removed} row(s) deleted`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
