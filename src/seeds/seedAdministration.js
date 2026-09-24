const { connectDB } = require("../config/db");
const SocietySettings = require("../modules/administration/societySettings.model");
const NumberingRule = require("../modules/administration/numberingRule.model");
const {
  Block,
  Street,
  PlotCategory,
  PropertyType,
  Department,
} = require("../modules/administration/masterData.model");

/**
 * Seed default administration data
 * Run with: node src/seeds/seedAdministration.js
 */

const DEFAULT_NUMBERING_RULES = [
  {
    entityType: NumberingRule.ENTITY_TYPES.MEMBER,
    prefix: "MEM",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PLOT,
    prefix: "PLT",
    currentSequence: 0,
    padLength: 5,
    resetPolicy: NumberingRule.RESET_POLICIES.NEVER,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.RECEIPT,
    prefix: "RCP",
    currentSequence: 0,
    padLength: 7,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.APPLICATION,
    prefix: "APP",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.NOC,
    prefix: "NOC",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.DOCUMENT,
    prefix: "DOC",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.INVOICE,
    prefix: "INV",
    currentSequence: 0,
    padLength: 7,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PAYMENT,
    prefix: "PAY",
    currentSequence: 0,
    padLength: 7,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.COMPLAINT,
    prefix: "CMP",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.APPOINTMENT,
    prefix: "APT",
    currentSequence: 0,
    padLength: 4,
    resetPolicy: NumberingRule.RESET_POLICIES.DAILY,
  },
];

const DEFAULT_BLOCKS = [
  { name: "Block A", code: "A", description: "Main residential block" },
  { name: "Block B", code: "B", description: "Secondary residential block" },
  { name: "Block C", code: "C", description: "Commercial block" },
];

const DEFAULT_STREETS = [
  { name: "Main Boulevard", code: "MB", description: "Primary access road" },
  { name: "Street 1", code: "S1" },
  { name: "Street 2", code: "S2" },
  { name: "Street 3", code: "S3" },
];

const DEFAULT_PLOT_CATEGORIES = [
  { name: "Residential", code: "RES", description: "Residential plots" },
  { name: "Commercial", code: "COM", description: "Commercial plots" },
  { name: "Mixed Use", code: "MIX", description: "Mixed-use plots" },
  { name: "Community", code: "CMY", description: "Community facilities" },
];

const DEFAULT_PROPERTY_TYPES = [
  { name: "House", code: "HSE", description: "Independent house" },
  { name: "Apartment", code: "APT", description: "Apartment unit" },
  { name: "Shop", code: "SHP", description: "Commercial shop" },
  { name: "Office", code: "OFC", description: "Office space" },
  { name: "Warehouse", code: "WHS", description: "Storage/warehouse" },
];

const DEFAULT_DEPARTMENTS = [
  { name: "Administration", code: "ADM", description: "Administrative office" },
  { name: "Finance", code: "FIN", description: "Finance and accounts" },
  { name: "Operations", code: "OPS", description: "Operations and maintenance" },
  { name: "Security", code: "SEC", description: "Security department" },
  { name: "HR", code: "HR", description: "Human resources" },
];

async function seed() {
  try {
    await connectDB();

    console.log("\n🌱 Seeding administration defaults...\n");

    // ── 1. Seed default society settings ───────────────
    const existingSettings = await SocietySettings.get();
    if (existingSettings && existingSettings._id) {
      console.log("   ⏭️  Society settings already exist, skipping.");
    } else {
      const defaults = SocietySettings.getDefaults();
      await SocietySettings.update(defaults);
      console.log("   ✅ Created default society settings");
    }

    // ── 2. Seed numbering rules ────────────────────────
    for (const rule of DEFAULT_NUMBERING_RULES) {
      const existing = await NumberingRule.findByEntityType(rule.entityType);
      if (existing) {
        console.log(`   ⏭️  Numbering rule for "${rule.entityType}" already exists, skipping.`);
      } else {
        await NumberingRule.create(rule);
        console.log(`   ✅ Created numbering rule: ${rule.entityType} (${rule.prefix})`);
      }
    }

    // ── 3. Seed master data ────────────────────────────
    const seedMasterData = async (model, data, label) => {
      for (const item of data) {
        const items = await model.find({ name: item.name });
        if (items.length > 0) {
          console.log(`   ⏭️  ${label} "${item.name}" already exists, skipping.`);
        } else {
          await model.create(item, null);
          console.log(`   ✅ Created ${label}: ${item.name}`);
        }
      }
    };

    await seedMasterData(Block, DEFAULT_BLOCKS, "Block");
    await seedMasterData(Street, DEFAULT_STREETS, "Street");
    await seedMasterData(PlotCategory, DEFAULT_PLOT_CATEGORIES, "Plot Category");
    await seedMasterData(PropertyType, DEFAULT_PROPERTY_TYPES, "Property Type");
    await seedMasterData(Department, DEFAULT_DEPARTMENTS, "Department");

    console.log("\n🎉 Administration seed completed successfully.\n");
  } catch (error) {
    console.error("\n❌ Administration seed failed:", error.message);
    throw error;
  }
}

if (require.main === module) {
  seed().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { seed };
