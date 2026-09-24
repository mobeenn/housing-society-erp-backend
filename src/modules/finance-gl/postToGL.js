const JournalEntry = require("./journalEntry.model");
const ApiError = require("../../utils/ApiError");

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Minimal, idempotent general-ledger posting adapter used by payroll.
 * Phase 13 integrations can replace this implementation without changing
 * the payroll service contract.
 */
async function postToGL({ date, sourceType, sourceId, description, lines = [], postedBy = null } = {}) {
  if (!sourceType || !sourceId) throw new ApiError(400, "GL sourceType and sourceId are required");
  const existing = await JournalEntry.findBySource(sourceType, sourceId);
  if (existing) return { journalEntry: existing, created: false };

  const normalizedLines = (lines || [])
    .map((line) => ({
      account: line.account || line.accountCode || line.name,
      accountCode: line.accountCode || line.account || null,
      description: line.description || null,
      debit: roundMoney(line.debit || 0),
      credit: roundMoney(line.credit || 0),
    }))
    .filter((line) => line.account && (line.debit !== 0 || line.credit !== 0));

  const totalDebit = roundMoney(normalizedLines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundMoney(normalizedLines.reduce((sum, line) => sum + line.credit, 0));
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.009) {
    throw new ApiError(400, "GL journal entry must contain equal, non-zero debits and credits");
  }
  if (normalizedLines.some((line) => line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0))) {
    throw new ApiError(400, "Each GL line must contain either a debit or a credit");
  }

  const journalEntry = await JournalEntry.create({
    date,
    sourceType,
    sourceId,
    description,
    lines: normalizedLines,
    totalDebit,
    totalCredit,
    status: "Posted",
    postedBy,
  });
  return { journalEntry, created: true };
}

module.exports = { postToGL, roundMoney };
module.exports.default = postToGL;
