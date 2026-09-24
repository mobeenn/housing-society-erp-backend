const RegistryBatch = require("./registryBatch.model");
const { Plot } = require("../properties/plot.model");
const ApiError = require("../../utils/ApiError");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function paginate(rows, page = 1, limit = 50) {
  const currentPage = Math.max(1, number(page) || 1);
  const pageSize = Math.min(200, Math.max(1, number(limit) || 50));
  const start = (currentPage - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    pagination: { page: currentPage, limit: pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) },
  };
}

async function enrich(batch) {
  if (!batch) return null;
  const plots = await Promise.all((batch.plots || []).map((id) => Plot.findById(id)));
  return {
    ...batch,
    plotRefs: plots.filter(Boolean).map((plot) => ({
      _id: plot._id,
      plotNumber: plot.plotNumber,
      fileNumber: plot.fileNumber,
      block: plot.block,
      status: plot.status,
    })),
  };
}

class RegistryService {
  static async plotOptions({ search = "", page = 1, limit = 200 } = {}) {
    const all = await Plot.find({}, { sort: { plotNumber: 1 } });
    const query = String(search || "").trim().toLowerCase();
    const rows = all.filter((plot) => !["Merged", "Cancelled", "BoughtBack"].includes(plot.status))
      .filter((plot) => !query || [plot.plotNumber, plot.fileNumber, plot.location].filter(Boolean).join(" ").toLowerCase().includes(query))
      .map((plot) => ({ _id: plot._id, plotNumber: plot.plotNumber, fileNumber: plot.fileNumber, status: plot.status }));
    return paginate(rows, page, limit);
  }

  static async list({ from, to, status, search, page = 1, limit = 50 } = {}) {
    const rows = await RegistryBatch.find({}, { sort: { requestDate: -1 } });
    const query = String(search || "").trim().toLowerCase();
    const filtered = rows.filter((batch) => {
      if (status && batch.status !== status) return false;
      if (from && String(batch.requestDate).slice(0, 10) < from) return false;
      if (to && String(batch.requestDate).slice(0, 10) > to) return false;
      if (query && !String(batch.remarks || "").toLowerCase().includes(query)) return false;
      return true;
    });
    const pageResult = paginate(filtered, page, limit);
    pageResult.data = await Promise.all(pageResult.data.map(enrich));
    return pageResult;
  }

  static async get(id) {
    const batch = await RegistryBatch.findById(id);
    if (!batch) throw new ApiError(404, "Registry batch not found");
    return enrich(batch);
  }

  static async create(data, req) {
    const plotIds = [...new Set(data.plots || [])];
    const plots = await Promise.all(plotIds.map((id) => Plot.findById(id)));
    if (plots.some((plot) => !plot)) throw new ApiError(400, "One or more plots were not found");
    if (plots.some((plot) => ["Merged", "Cancelled", "BoughtBack"].includes(plot.status))) {
      throw new ApiError(409, "Terminal lifecycle plots cannot be added to a registry batch");
    }
    const batch = await RegistryBatch.create({
      plots: plotIds,
      requestDate: data.requestDate,
      remarks: data.remarks,
      createdBy: req.user._id,
    });
    await createAuditLog({
      req,
      entityType: "RegistryBatch",
      entityId: batch._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: batch },
    });
    return this.get(batch._id);
  }

  static async complete(id, data, req) {
    const batch = await RegistryBatch.findById(id);
    if (!batch) throw new ApiError(404, "Registry batch not found");
    if (batch.status === RegistryBatch.STATUS.COMPLETED) return this.get(id);
    const completedDate = new Date().toISOString();
    await RegistryBatch.update(id, {
      status: RegistryBatch.STATUS.COMPLETED,
      completedDate,
      remarks: data.remarks === undefined ? batch.remarks : data.remarks,
      completedBy: req.user._id,
    });
    await createAuditLog({
      req,
      entityType: "RegistryBatch",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { status: { before: batch.status, after: RegistryBatch.STATUS.COMPLETED }, completedDate },
    });
    return this.get(id);
  }
}

module.exports = RegistryService;
