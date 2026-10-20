const RbacService = require("../rbac/service");
const SocietySettings = require("../administration/societySettings.model");
const { Booking } = require("../bookings/booking.model");
const { Refund } = require("../payments/payment.model");
const Expense = require("../expenses/expense.model");
const TransferRequest = require("../transfers/transfer.model");
const NocApplication = require("../nocs/noc.model");
const PossessionApplication = require("../possession/possession.model");
const { ConstructionApplication } = require("../construction/construction.model");
const PayrollRun = require("../hr-payroll/payrollRun.model");
const LeaveRequest = require("../hr/leaveRequest.model");

const PER_MODULE_CAP = 8;
const SOD_MODULES = new Set(["bookings", "refunds", "expenses", "hr-payroll"]);

function actorId(user) {
  return user?.id || user?._id || null;
}

function sortByCreatedDesc(a, b) {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

function itemBase(doc, extra) {
  return {
    id: doc._id,
    createdAt: doc.createdAt || null,
    createdBy: doc.createdBy || doc.generatedBy || null,
    ...extra,
  };
}

async function loadSlice(Model, query) {
  const rows = await Model.find(query, { sort: { createdAt: -1 }, limit: PER_MODULE_CAP });
  return rows || [];
}

class ApprovalsService {
  static async pending(user) {
    const settings = await SocietySettings.get();
    const enforceSoD = settings?.enforceSeparationOfDuties !== false;
    const superAdmin = RbacService.isSuperAdmin(user);
    const uid = actorId(user);

    const checks = await Promise.all([
      RbacService.isAllowed(user, "bookings", "approve"),
      RbacService.isAllowed(user, "refunds", "approve"),
      RbacService.isAllowed(user, "expenses", "approve"),
      RbacService.isAllowed(user, "transfers", "approve"),
      RbacService.isAllowed(user, "nocs", "approve"),
      RbacService.isAllowed(user, "possession", "approve"),
      RbacService.isAllowed(user, "construction", "approve"),
      RbacService.isAllowed(user, "hr-payroll", "approve"),
      RbacService.isAllowed(user, "hr", "edit"),
    ]);
    const [
      canBookings,
      canRefunds,
      canExpenses,
      canTransfers,
      canNocs,
      canPossession,
      canConstruction,
      canPayroll,
      canLeave,
    ] = checks;

    const collectors = [];
    if (canBookings) collectors.push(this._bookings());
    if (canRefunds) collectors.push(this._refunds());
    if (canExpenses) collectors.push(this._expenses());
    if (canTransfers) collectors.push(this._transfers());
    if (canNocs) collectors.push(this._nocs());
    if (canPossession) collectors.push(this._possession());
    if (canConstruction) collectors.push(this._construction());
    if (canPayroll) collectors.push(this._payroll());
    if (canLeave) collectors.push(this._leave());

    const batches = await Promise.all(collectors);
    let items = batches.flat();

    if (enforceSoD && !superAdmin && uid) {
      items = items.filter((item) => {
        if (!SOD_MODULES.has(item.moduleKey)) return true;
        if (!item.createdBy) return true;
        return String(item.createdBy) !== String(uid);
      });
    }

    items.sort(sortByCreatedDesc);

    const byModule = {};
    for (const item of items) {
      byModule[item.moduleKey] = (byModule[item.moduleKey] || 0) + 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: { total: items.length, byModule },
      items,
      pagination: { limit: PER_MODULE_CAP, truncated: false },
    };
  }

  static async _bookings() {
    const rows = await loadSlice(Booking, { status: "Pending Approval" });
    return rows.map((doc) =>
      itemBase(doc, {
        moduleKey: "bookings",
        entityType: "Booking",
        title: `Booking — ${doc.bookingNumber || doc._id}`,
        subtitle: `Pending Approval`,
        status: doc.status,
        stage: "approve",
        stageLabel: "Awaiting booking approval",
        detailPath: `/bookings/${doc._id}`,
      })
    );
  }

  static async _refunds() {
    const rows = await loadSlice(Refund, { status: Refund.STATUS.PENDING });
    return rows.map((doc) =>
      itemBase(doc, {
        moduleKey: "refunds",
        entityType: "Refund",
        title: `Refund — PKR ${Number(doc.amount || 0).toLocaleString("en-PK")}`,
        subtitle: "Pending approval",
        status: doc.status,
        stage: "approve",
        stageLabel: "Awaiting refund approval",
        detailPath: `/refunds`,
      })
    );
  }

  static async _expenses() {
    const rows = await loadSlice(Expense, { status: Expense.STATUS.PENDING });
    return rows.map((doc) =>
      itemBase(doc, {
        moduleKey: "expenses",
        entityType: "Expense",
        title: `Expense — ${doc.category || "General"} · PKR ${Number(doc.amount || 0).toLocaleString("en-PK")}`,
        subtitle: "Pending approval",
        status: doc.status,
        stage: "approve",
        stageLabel: "Awaiting expense approval",
        detailPath: `/expenses/${doc._id}`,
      })
    );
  }

  static async _transfers() {
    const rows = await TransferRequest.find(
      {
        status: {
          $in: [
            TransferRequest.STATUS.DRAFT,
            TransferRequest.STATUS.PENDING_VERIFICATION,
            TransferRequest.STATUS.PENDING_APPROVAL,
            TransferRequest.STATUS.APPROVED,
          ],
        },
      },
      { sort: { createdAt: -1 }, limit: PER_MODULE_CAP * 2 }
    );
    const items = [];
    for (const doc of rows || []) {
      let stage;
      let stageLabel;
      if (
        doc.status === TransferRequest.STATUS.DRAFT ||
        doc.status === TransferRequest.STATUS.PENDING_VERIFICATION
      ) {
        stage = "verify";
        stageLabel = "Awaiting transfer verification";
      } else if (doc.status === TransferRequest.STATUS.PENDING_APPROVAL) {
        stage = "approve";
        stageLabel = "Awaiting transfer approval";
      } else if (doc.status === TransferRequest.STATUS.APPROVED) {
        stage = "complete";
        stageLabel = "Awaiting transfer completion";
      } else {
        continue;
      }
      items.push(
        itemBase(doc, {
          moduleKey: "transfers",
          entityType: "TransferRequest",
          title: `Transfer — ${doc._id}`,
          subtitle: `${doc.status} · ${stageLabel}`,
          status: doc.status,
          stage,
          stageLabel,
          detailPath: `/transfers/${doc._id}`,
        })
      );
      if (items.length >= PER_MODULE_CAP) break;
    }
    return items;
  }

  static async _nocs() {
    const rows = await NocApplication.find(
      {
        status: {
          $in: [
            NocApplication.STATUS.APPLIED,
            NocApplication.STATUS.DUES_PENDING,
            NocApplication.STATUS.UNDER_VERIFICATION,
            NocApplication.STATUS.APPROVED,
          ],
        },
      },
      { sort: { createdAt: -1 }, limit: PER_MODULE_CAP * 2 }
    );
    const items = [];
    for (const doc of rows || []) {
      let stage;
      let stageLabel;
      if (doc.status === NocApplication.STATUS.APPLIED) {
        stage = "verify";
        stageLabel = "Awaiting NOC verification";
      } else if (doc.status === NocApplication.STATUS.DUES_PENDING) {
        stage = "clear-dues";
        stageLabel = "Awaiting dues clearance";
      } else if (
        doc.status === NocApplication.STATUS.UNDER_VERIFICATION &&
        doc.feePaid &&
        doc.duesCleared
      ) {
        stage = "approve";
        stageLabel = "Awaiting NOC approval";
      } else if (doc.status === NocApplication.STATUS.APPROVED) {
        stage = "issue";
        stageLabel = "Awaiting NOC issuance";
      } else {
        continue;
      }
      items.push(
        itemBase(doc, {
          moduleKey: "nocs",
          entityType: "NocApplication",
          title: `NOC — ${doc.nocType || "Application"}`,
          subtitle: `${doc.status} · ${stageLabel}`,
          status: doc.status,
          stage,
          stageLabel,
          detailPath: `/nocs/${doc._id}`,
        })
      );
      if (items.length >= PER_MODULE_CAP) break;
    }
    return items;
  }

  static async _possession() {
    const rows = await PossessionApplication.find(
      {
        status: {
          $in: [
            PossessionApplication.STATUS.APPLIED,
            PossessionApplication.STATUS.UNDER_VERIFICATION,
            PossessionApplication.STATUS.APPROVED,
          ],
        },
      },
      { sort: { createdAt: -1 }, limit: PER_MODULE_CAP * 2 }
    );
    const items = [];
    for (const doc of rows || []) {
      let stage;
      let stageLabel;
      if (doc.status === PossessionApplication.STATUS.APPLIED) {
        stage = "verify";
        stageLabel = "Awaiting possession verification";
      } else if (doc.status === PossessionApplication.STATUS.UNDER_VERIFICATION) {
        stage = "approve";
        stageLabel = "Awaiting possession approval";
      } else if (doc.status === PossessionApplication.STATUS.APPROVED && doc.chargesPaid) {
        stage = "issue";
        stageLabel = "Awaiting possession letter";
      } else {
        continue;
      }
      items.push(
        itemBase(doc, {
          moduleKey: "possession",
          entityType: "PossessionApplication",
          title: `Possession — ${doc._id}`,
          subtitle: `${doc.status} · ${stageLabel}`,
          status: doc.status,
          stage,
          stageLabel,
          detailPath: `/possession/${doc._id}`,
        })
      );
      if (items.length >= PER_MODULE_CAP) break;
    }
    return items;
  }

  static async _construction() {
    const rows = await loadSlice(ConstructionApplication, {
      status: ConstructionApplication.STATUS.UNDER_REVIEW,
    });
    return rows.map((doc) =>
      itemBase(doc, {
        moduleKey: "construction",
        entityType: "ConstructionApplication",
        title: `Construction — ${doc.constructionType || doc.type || "Application"}`,
        subtitle: "Under review · awaiting approval",
        status: doc.status,
        stage: "approve",
        stageLabel: "Awaiting construction approval",
        detailPath: `/construction/${doc._id}`,
      })
    );
  }

  static async _payroll() {
    const rows = await loadSlice(PayrollRun, { status: PayrollRun.STATUS.DRAFT });
    return rows.map((doc) =>
      itemBase(
        { ...doc, createdBy: doc.generatedBy },
        {
          moduleKey: "hr-payroll",
          entityType: "PayrollRun",
          title: `Payroll — ${doc.month || ""} ${doc.year || ""}`.trim() || `Payroll ${doc._id}`,
          subtitle: "Draft · awaiting approval",
          status: doc.status,
          stage: "approve",
          stageLabel: "Awaiting payroll approval",
          detailPath: `/hr/payroll`,
        }
      )
    );
  }

  static async _leave() {
    const rows = await loadSlice(LeaveRequest, { status: LeaveRequest.STATUSES.PENDING });
    return rows.map((doc) =>
      itemBase(doc, {
        moduleKey: "hr",
        entityType: "LeaveRequest",
        title: `Leave — ${doc.leaveType || "Request"}`,
        subtitle: "Pending HR decision",
        status: doc.status,
        stage: "edit",
        stageLabel: "Awaiting leave decision",
        detailPath: `/hr/leave-requests`,
      })
    );
  }
}

module.exports = ApprovalsService;
