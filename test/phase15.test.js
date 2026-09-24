const test = require("node:test");
const assert = require("node:assert/strict");
const { executeMergeSchema } = require("../src/modules/plot-merge/validation");
const { executeBuybackSchema } = require("../src/modules/buyback/validation");
const { CONFIRMATION_TEXT } = require("../src/modules/lifecycle/confirmation");
const { createLifecyclePdf } = require("../src/modules/lifecycle/pdf");

const mergePayload = (confirmationText) => ({
  mergedPlots: ["plot-a", "plot-b"],
  resultingPlot: "plot-a",
  adjustedAmounts: [{ plot: "plot-a", amount: 100 }],
  confirmationText,
});

const buybackPayload = (confirmationText, type = "BuyBack") => ({
  booking: "booking-a",
  type,
  paymentType: "Cash",
  deductionPercent: 10,
  settlementAmount: 900,
  confirmationText,
});

test("plot merge requires the exact irreversible confirmation", () => {
  assert.equal(executeMergeSchema.safeParse(mergePayload(CONFIRMATION_TEXT.PLOT_MERGE)).success, true);
  assert.equal(executeMergeSchema.safeParse(mergePayload("merge plots")).success, false);
  assert.equal(executeMergeSchema.safeParse({ ...mergePayload(CONFIRMATION_TEXT.PLOT_MERGE), resultingPlot: undefined }).success, false);
});

test("buyback and cancel each require their matching confirmation", () => {
  assert.equal(executeBuybackSchema.safeParse(buybackPayload(CONFIRMATION_TEXT.BUYBACK)).success, true);
  assert.equal(executeBuybackSchema.safeParse(buybackPayload(CONFIRMATION_TEXT.CANCEL, "Cancel")).success, true);
  assert.equal(executeBuybackSchema.safeParse(buybackPayload(CONFIRMATION_TEXT.CANCEL)).success, false);
});

test("lifecycle PDFs are generated as binary PDF buffers", async () => {
  const buffer = await createLifecyclePdf({ title: "Test", reference: "TEST-1", lines: ["Hello"] });
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
