const PlotMerge = require("./plotMerge.model");
const { Plot } = require("../properties/plot.model");
const PlotService = require("../properties/service");
const { Booking } = require("../bookings/booking.model");
const InvoiceService = require("../invoices/service");
const ApiError = require("../../utils/ApiError");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const { createLifecyclePdf } = require("../lifecycle/pdf");

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const sumAmounts = (rows = []) => rows.reduce((sum, row) => sum + number(row.amount), 0);
const safePlot = (plot) => plot ? {
  _id: plot._id,
  plotNumber: plot.plotNumber,
  fileNumber: plot.fileNumber,
  block: plot.block,
  street: plot.street,
  status: plot.status,
  mergedIntoPlot: plot.mergedIntoPlot || null,
} : null;

async function enrich(merge) {
  if (!merge) return null;
  const plots = await Promise.all((merge.mergedPlots || []).map((id) => Plot.findById(id)));
  const plotMap = new Map(plots.filter(Boolean).map((plot) => [plot._id, plot]));
  return {
    ...merge,
    plotRefs: plots.map(safePlot),
    resultingPlotRef: safePlot(plotMap.get(merge.resultingPlot)),
  };
}

class PlotMergeService {
  static async eligiblePlots() {
    const plots = await Plot.find({}, { sort: { plotNumber: 1 } });
    return plots
      .filter((plot) => [Plot.STATUS.AVAILABLE, Plot.STATUS.RESERVED, Plot.STATUS.BOOKED, Plot.STATUS.ALLOTTED].includes(plot.status) && plot.isBlocked !== true)
      .map(safePlot);
  }

  static async list({ page = 1, limit = 50, status } = {}) {
    const query = status ? { status } : {};
    const rows = await PlotMerge.find(query, { sort: { date: -1 } });
    const currentPage = Math.max(1, number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, number(limit) || 50));
    const start = (currentPage - 1) * pageSize;
    return {
      data: await Promise.all(rows.slice(start, start + pageSize).map(enrich)),
      pagination: { page: currentPage, limit: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) },
    };
  }

  static async get(id) {
    const merge = await PlotMerge.findById(id);
    if (!merge) throw new ApiError(404, "Plot merge not found");
    return enrich(merge);
  }

  static async execute(data, req) {
    const mergedPlots = [...new Set(data.mergedPlots || [])];
    if (mergedPlots.length < 2) throw new ApiError(400, "At least two distinct plots are required");
    const resultingPlot = data.resultingPlot;
    if (!resultingPlot) throw new ApiError(400, "resultingPlot is required for an irreversible merge");
    if (!mergedPlots.includes(resultingPlot)) throw new ApiError(400, "resultingPlot must be one of mergedPlots");

    const plots = await Promise.all(mergedPlots.map((id) => Plot.findById(id)));
    if (plots.some((plot) => !plot)) throw new ApiError(400, "One or more selected plots were not found");
    const mergeableStatuses = new Set([Plot.STATUS.AVAILABLE, Plot.STATUS.RESERVED, Plot.STATUS.BOOKED, Plot.STATUS.ALLOTTED]);
    if (plots.some((plot) => !mergeableStatuses.has(plot.status))) {
      throw new ApiError(409, "Only available, reserved, booked, or allotted plots can be merged");
    }
    if (plots.some((plot) => plot.isBlocked === true)) {
      throw new ApiError(409, "Blocked plots cannot be merged until recovery is resolved");
    }
    const activeBookings = (await Booking.find({ plot: { $in: mergedPlots } })).filter((booking) => [Booking.STATUS.PENDING_APPROVAL, Booking.STATUS.CONFIRMED].includes(booking.status));
    if (activeBookings.length) throw new ApiError(409, "Plots with active bookings cannot be merged");

    const amountRows = data.adjustedAmounts || [];
    if (new Set(amountRows.map((item) => item.plot)).size !== amountRows.length) throw new ApiError(400, "Adjusted amounts must contain one row per plot");
    if (amountRows.some((item) => !mergedPlots.includes(item.plot))) throw new ApiError(400, "Adjusted amounts may only reference selected plots");
    const suppliedAmounts = new Map(amountRows.map((item) => [item.plot, { ...item, amount: number(item.amount) }]));
    const adjustedAmounts = mergedPlots.map((plotId) => suppliedAmounts.get(plotId) || { plot: plotId, amount: 0, reason: "" });

    const pending = await PlotMerge.create({
      mergedPlots,
      resultingPlot,
      adjustedAmounts,
      performedBy: req.user._id,
      date: new Date().toISOString(),
      status: PlotMerge.STATUS.PENDING,
    });

    try {
      const invoice = await InvoiceService.registerInvoice("PlotMerge", pending, {
        relatedEntityType: "PlotMerge",
        relatedEntityId: pending._id,
        fileUrl: `/api/plot-merge/${pending._id}/invoice.pdf`,
        plot: resultingPlot,
        amount: sumAmounts(adjustedAmounts),
        issueDate: pending.date,
        createdBy: req.user._id,
      });
      const sourceIds = mergedPlots.filter((id) => id !== resultingPlot);
      for (const plotId of sourceIds) {
        await PlotService.update(plotId, {
          status: Plot.STATUS.MERGED,
          currentOwner: null,
          mergedIntoPlot: resultingPlot,
          lifecycleAction: "Merged",
          lifecycleRecord: pending._id,
        }, req);
      }
      await PlotService.update(resultingPlot, {
        mergedFromPlots: sourceIds,
        lifecycleAction: "MergeResult",
        lifecycleRecord: pending._id,
      }, req);
      const completed = await PlotMerge.update(pending._id, {
        status: PlotMerge.STATUS.COMPLETED,
        invoiceId: invoice._id,
        invoiceUrl: invoice.fileUrl,
      });
      await createAuditLog({
        req,
        entityType: "PlotMerge",
        entityId: pending._id,
        action: AuditLog.ACTIONS.CREATE,
        changes: { after: { ...pending, status: PlotMerge.STATUS.COMPLETED, invoiceId: invoice._id } },
      });
      return this.get(completed._id || pending._id);
    } catch (error) {
      await PlotMerge.update(pending._id, { status: PlotMerge.STATUS.FAILED, failureReason: error.message });
      throw error;
    }
  }

  static async invoicePdf(id) {
    const merge = await this.get(id);
    if (merge.status !== PlotMerge.STATUS.COMPLETED) throw new ApiError(409, "Only completed plot merges have an invoice");
    const lines = [
      { label: "Merged plots", value: merge.mergedPlots.join(", ") },
      { label: "Resulting plot", value: merge.resultingPlotRef?.plotNumber || merge.resultingPlot },
      { label: "Adjusted amount", value: sumAmounts(merge.adjustedAmounts).toFixed(2) },
      { label: "Performed by", value: merge.performedBy || "System" },
      { label: "Date", value: merge.date },
    ];
    merge.adjustedAmounts.forEach((item) => lines.push({ label: `Adjustment ${item.plot}`, value: item.amount }));
    return createLifecyclePdf({
      title: "Plot Merge Invoice",
      reference: merge._id,
      lines,
      footer: "This document records an irreversible plot merge transaction.",
    });
  }
}

module.exports = PlotMergeService;
