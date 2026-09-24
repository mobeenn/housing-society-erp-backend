const { connectDB } = require("../config/db");
const NumberingRule = require("../modules/administration/numberingRule.model");

/**
 * Seed numbering rules for all entity types
 * Run with: node src/seeds/seedNumberingRules.js
 */

const NUMBERING_RULES = [
  {
    entityType: NumberingRule.ENTITY_TYPES.MEMBER,
    prefix: "MEM",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.NEVER,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PLOT,
    prefix: "PLT",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.NEVER,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.RECEIPT,
    prefix: "RCP",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.INVOICE,
    prefix: "INV",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PAYMENT,
    prefix: "PAY",
    currentSequence: 0,
    padLength: 6,
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
    resetPolicy: NumberingRule.RESET_POLICIES.NEVER,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.APPLICATION,
    prefix: "APP",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PURCHASE_REQUEST,
    prefix: "PR",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.QUOTATION,
    prefix: "QT",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
  {
    entityType: NumberingRule.ENTITY_TYPES.PURCHASE_ORDER,
    prefix: "PO",
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
  {
    entityType: NumberingRule.ENTITY_TYPES.GRN,
    prefix: "GRN",
    currentSequence: 0,
    padLength: 6,
    resetPolicy: NumberingRule.RESET_POLICIES.YEARLY,
  },
];

async function seed() {
  try {
    await connectDB();

    console.log("\n🌱 Seeding numbering rules...\n");

    for (const ruleData of NUMBERING_RULES) {
      const existing = await NumberingRule.findByEntityType(ruleData.entityType);
      if (existing) {
        console.log(`   ⏭️  Numbering rule for "${ruleData.entityType}" already exists, skipping.`);
      } else {
        await NumberingRule.create(ruleData);
        console.log(`   ✅ Created numbering rule: ${ruleData.entityType} (${ruleData.prefix})`);
      }
    }

    console.log("\n🎉 Numbering rules seed completed successfully.\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seed failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
