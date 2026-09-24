const { connectDB } = require("../config/db");
const { Payment } = require("../modules/payments/payment.model");
const TransferRequest = require("../modules/transfers/transfer.model");
const NocApplication = require("../modules/nocs/noc.model");
const PossessionApplication = require("../modules/possession/possession.model");
const { ConstructionApplication } = require("../modules/construction/construction.model");
const Expense = require("../modules/expenses/expense.model");
const Invoice = require("../modules/invoices/invoice.model");
const InvoiceService = require("../modules/invoices/service");
const PlotMerge = require("../modules/plot-merge/plotMerge.model");
const BuyBack = require("../modules/buyback/buyback.model");

async function registerAll(invoiceType, records, options = {}) {
  let created = 0;
  let updated = 0;
  for (const record of records) {
    const before = await Invoice.findOne({
      invoiceType,
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: record._id,
    });
    await InvoiceService.registerInvoice(invoiceType, record, options.overrides || {});
    if (before) updated += 1;
    else created += 1;
  }
  return { created, updated, total: records.length };
}

async function backfill() {
  await connectDB();
  const [payments, transfers, nocs, possessions, constructions, expenses, plotMerges, buybacks] = await Promise.all([
    Payment.find({}),
    TransferRequest.find({ status: TransferRequest.STATUS.COMPLETED }),
    NocApplication.find({ status: NocApplication.STATUS.ISSUED }),
    PossessionApplication.find({ status: PossessionApplication.STATUS.POSSESSED }),
    ConstructionApplication.find({ status: ConstructionApplication.STATUS.APPROVED }),
    Expense.find({}),
    PlotMerge.find({ status: PlotMerge.STATUS.COMPLETED }),
    BuyBack.find({ status: BuyBack.STATUS.COMPLETED }),
  ]);

  const results = {
    payments: await registerAll("Installment", payments, { relatedEntityType: "Payment" }),
    transfers: await registerAll("Transfer", transfers, { relatedEntityType: "TransferRequest" }),
    nocs: await registerAll("NOC", nocs, { relatedEntityType: "NocApplication" }),
    possessions: await registerAll("Possession", possessions, { relatedEntityType: "PossessionApplication" }),
    constructions: await registerAll("Construction", constructions, { relatedEntityType: "ConstructionApplication" }),
    expenses: await registerAll("Expense", expenses, { relatedEntityType: "Expense" }),
    plotMerges: await registerAll("PlotMerge", plotMerges, { relatedEntityType: "PlotMerge" }),
    buybacks: await registerAll("BuyBack", buybacks, { relatedEntityType: "BuyBack" }),
  };

  console.log("\n🧾 Invoice registry backfill completed.");
  for (const [type, result] of Object.entries(results)) {
    console.log(`   ${type}: ${result.created} created, ${result.updated} existing refreshed (${result.total} source records)`);
  }
  console.log(`   Registry total: ${await Invoice.count()}\n`);
}

if (require.main === module) {
  backfill().catch((error) => {
    console.error("Invoice backfill failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { backfill };
