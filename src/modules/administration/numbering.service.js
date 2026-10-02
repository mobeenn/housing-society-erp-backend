const { prisma } = require("../../config/prisma");

/**
 * Numbering Service
 * Atomic number generation using PostgreSQL UPDATE ... RETURNING
 * Supports reset policies: never, daily, yearly, monthly
 * Format: {prefix}-{datePart}-{paddedSequence}
 */

const RESET_POLICIES = {
  NEVER: "never",
  DAILY: "daily",
  YEARLY: "yearly",
  MONTHLY: "monthly",
};

/**
 * Get the date part for the numbering format
 * @param {string} resetPolicy
 * @param {Date} date
 * @returns {string}
 */
function getDatePart(resetPolicy, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (resetPolicy) {
    case RESET_POLICIES.DAILY:
      return `${year}${month}${day}`;
    case RESET_POLICIES.MONTHLY:
      return `${year}${month}`;
    case RESET_POLICIES.YEARLY:
      return `${year}`;
    case RESET_POLICIES.NEVER:
    default:
      return `${year}`;
  }
}

/**
 * Check if a reset is needed based on the reset policy
 * @param {string} resetPolicy
 * @param {string|null} lastResetPeriod
 * @param {Date} now
 * @returns {boolean}
 */
function needsReset(resetPolicy, lastResetPeriod, now = new Date()) {
  if (!lastResetPeriod) return true;

  const currentPeriod = getDatePart(resetPolicy, now);

  switch (resetPolicy) {
    case RESET_POLICIES.DAILY:
      return lastResetPeriod !== currentPeriod;
    case RESET_POLICIES.MONTHLY:
      return lastResetPeriod !== currentPeriod;
    case RESET_POLICIES.YEARLY:
      return lastResetPeriod !== currentPeriod;
    case RESET_POLICIES.NEVER:
    default:
      return false;
  }
}

/**
 * Get the next number for an entity type
 * Uses atomic UPDATE ... RETURNING to prevent duplicate numbers
 * Can be executed inside a transaction by passing a tx client
 *
 * @param {string} entityType - The entity type (e.g., "member", "plot", "receipt")
 * @param {object} [tx] - Optional Prisma transaction client
 * @returns {Promise<string>} The formatted number (e.g., "MEM-2026-000123")
 */
async function getNextNumber(entityType, tx = null) {
  const client = tx || prisma;

  // First, try to atomically increment the sequence
  const result = await client.$queryRawUnsafe(
    `UPDATE "numbering_rules"
     SET "currentSequence" = "currentSequence" + 1,
         "updatedAt" = NOW()
     WHERE "entityType" = $1
     RETURNING "prefix", "currentSequence", "padLength", "resetPolicy", "lastResetPeriod"`,
    entityType
  );

  if (result && result.length > 0) {
    const rule = result[0];

    // Check if reset is needed
    if (needsReset(rule.resetPolicy, rule.lastResetPeriod)) {
      // Reset the sequence to 1
      const resetResult = await client.$queryRawUnsafe(
        `UPDATE "numbering_rules"
         SET "currentSequence" = 1,
             "lastResetPeriod" = $2,
             "updatedAt" = NOW()
         WHERE "entityType" = $1
         RETURNING "prefix", "currentSequence", "padLength"`,
        entityType,
        getDatePart(rule.resetPolicy)
      );

      if (resetResult && resetResult.length > 0) {
        const resetRule = resetResult[0];
        return formatNumber(
          resetRule.prefix,
          resetRule.currentSequence,
          resetRule.padLength,
          rule.resetPolicy
        );
      }
    }

    return formatNumber(
      rule.prefix,
      rule.currentSequence,
      rule.padLength,
      rule.resetPolicy
    );
  }

  // If no rule found, try to find it without updating (for error message)
  const existingRule = await client.numberingRule.findUnique({
    where: { entityType },
  });

  if (!existingRule) {
    throw new Error(`Numbering rule not found for entity type: ${entityType}`);
  }

  // If we get here, the update failed but the rule exists - try again
  return getNextNumber(entityType, tx);
}

/**
 * Format the number with prefix, date part, and padded sequence
 * @param {string} prefix
 * @param {number} sequence
 * @param {number} padLength
 * @param {string} resetPolicy
 * @returns {string}
 */
function formatNumber(prefix, sequence, padLength = 6, resetPolicy = "never") {
  const datePart = getDatePart(resetPolicy);
  const paddedSequence = String(sequence).padStart(padLength, "0");
  return `${prefix}-${datePart}-${paddedSequence}`;
}

/**
 * Get the current sequence number without incrementing
 * @param {string} entityType
 * @returns {Promise<number>}
 */
async function getCurrentSequence(entityType) {
  const rule = await prisma.numberingRule.findUnique({
    where: { entityType },
  });
  return rule ? rule.currentSequence : 0;
}

/**
 * Reset the sequence for an entity type
 * @param {string} entityType
 * @param {number} [newSequence=0]
 * @returns {Promise<void>}
 */
async function resetSequence(entityType, newSequence = 0) {
  await prisma.numberingRule.update({
    where: { entityType },
    data: {
      currentSequence: newSequence,
      lastResetPeriod: null,
    },
  });
}

module.exports = {
  getNextNumber,
  getCurrentSequence,
  resetSequence,
  RESET_POLICIES,
  getDatePart,
  needsReset,
  formatNumber,
};
