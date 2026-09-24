const Invoice = require("./invoice.model");
const Member = require("../members/member.model");
const { Plot } = require("../properties/plot.model");
const Vendor = require("../procurement/vendor.model");
const ApiError = require("../../utils/ApiError");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");

const SOURCE_CONFIG = {
  Installment: {
    relatedEntityType: "Payment",
    fileUrl: (id) => `/api/payments/${id}/receipt.pdf`,
    amount: (source) => source.amount,
    issueDate: (source) => source.createdAt,
  },
  Transfer: {
    relatedEntityType: "TransferRequest",
    fileUrl: (id) => `/api/transfers/${id}/certificate.pdf`,
    amount: (source) => source.amount ?? source.transferFee ?? source.transferAmount ?? source.value,
    issueDate: (source) => source.completedAt,
  },
  NOC: {
    relatedEntityType: "NocApplication",
    fileUrl: (id) => `/api/nocs/${id}/certificate.pdf`,
    amount: (source) => source.feeAmount,
    issueDate: (source) => source.issuedDate,
  },
  Possession: {
    relatedEntityType: "PossessionApplication",
    fileUrl: (id) => `/api/possession/${id}/letter.pdf`,
    amount: (source) => source.possessionCharges,
    issueDate: (source) => source.handoverDate,
  },
  Construction: {
    relatedEntityType: "ConstructionApplication",
    fileUrl: (id) => `/api/construction/${id}/completion-certificate.pdf`,
    amount: (source) => source.fees?.amount ?? source.fees,
    issueDate: (source) => source.approvedAt,
  },
  PlotMerge: {
    relatedEntityType: "PlotMerge",
    fileUrl: (id) => `/api/plot-merge/${id}/invoice.pdf`,
    amount: (source) => source.adjustedAmounts?.reduce((sum, item) => sum + Number(item.amount || 0), 0) ?? source.amount ?? 0,
    issueDate: (source) => source.date,
  },
  BuyBack: {
    relatedEntityType: "BuyBack",
    fileUrl: (id) => `/api/buyback/${id}/invoice.pdf`,
    amount: (source) => source.settlementAmount ?? source.amount ?? 0,
    issueDate: (source) => source.date,
  },
  Expense: {
    relatedEntityType: "Expense",
    fileUrl: () => null,
    amount: (source) => source.amount,
    issueDate: (source) => source.date,
  },
};

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sourceFileUrl(source, container, invoiceType, relatedEntityId) {
  const explicitUrl = firstValue(
    container.fileUrl,
    source.fileUrl,
    source.documentUrl,
    source.certificateUrl,
    source.receiptUrl,
    source.possessionLetterUrl,
    source.completionCertificateUrl,
  );
  const configuredUrl = SOURCE_CONFIG[invoiceType]?.fileUrl?.(relatedEntityId) || null;

  // The development seeds use placeholder document URLs. Reprints must
  // resolve to the live authenticated generator in that case.
  if (configuredUrl && /demo\.housing\.local/i.test(explicitUrl || "")) {
    return configuredUrl;
  }

  return explicitUrl || configuredUrl;
}

class InvoiceService {
  static async registerInvoice(invoiceType, sourceDoc = {}, overrides = {}) {
    if (!Invoice.TYPES.includes(invoiceType)) {
      throw new ApiError(400, `Unsupported invoice type: ${invoiceType}`);
    }

    const container = sourceDoc || {};
    const source = container.source || container.record || container;
    const config = SOURCE_CONFIG[invoiceType] || {};
    const relatedEntityType = firstValue(
      overrides.relatedEntityType,
      source.relatedEntityType,
      config.relatedEntityType,
    );
    const relatedEntityId = firstValue(
      overrides.relatedEntityId,
      source.relatedEntityId,
      source._id,
      source.id,
    );

    if (!relatedEntityType || !relatedEntityId) {
      throw new ApiError(400, "Invoice source relation is required");
    }

    const sourceKey = `${invoiceType}:${relatedEntityType}:${relatedEntityId}`;
    const existing = await Invoice.findBySourceKey(sourceKey)
      || await Invoice.findBySource(invoiceType, relatedEntityType, relatedEntityId);
    const fileUrl = hasOwn(overrides, "fileUrl")
      ? overrides.fileUrl
      : sourceFileUrl(source, container, invoiceType, relatedEntityId);
    const member = firstValue(
      overrides.member,
      source.member,
      source.memberId,
      source.memberRef?._id,
      source.toMember,
      source.toMemberRef?._id,
      source.fromMember,
    ) || null;
    const dealer = firstValue(overrides.dealer, source.dealer, source.vendor, source.vendorId) || null;
    const plot = firstValue(overrides.plot, source.plot, source.plotId, source.plotRef?._id) || null;
    const amount = Number(firstValue(
      overrides.amount,
      typeof config.amount === "function" ? config.amount(source) : null,
      source.amount,
      source.totalAmount,
    ) || 0);
    const issueDate = normalizeDate(firstValue(
      overrides.issueDate,
      typeof config.issueDate === "function" ? config.issueDate(source) : null,
      source.issueDate,
      source.createdAt,
    ));
    const createdBy = firstValue(overrides.createdBy, source.createdBy, source.collectedBy) || null;

    if (existing) {
      const patch = {
        member,
        dealer,
        plot,
        amount,
        issueDate,
      };
      if (createdBy) patch.createdBy = createdBy;
      if (fileUrl) patch.fileUrl = fileUrl;
      await Invoice.update(existing._id, patch);
      return Invoice.findById(existing._id);
    }

    return Invoice.create({
      invoiceType,
      relatedEntityType,
      relatedEntityId,
      sourceKey,
      member,
      dealer,
      plot,
      amount,
      issueDate,
      fileUrl,
      createdBy,
    });
  }

  /** Registration must never make an existing business document operation fail. */
  static async safeRegisterInvoice(invoiceType, sourceDoc, overrides = {}) {
    try {
      return await this.registerInvoice(invoiceType, sourceDoc, overrides);
    } catch (error) {
      console.error(`Invoice registration failed for ${invoiceType}:`, error.message);
      return null;
    }
  }

  static async enrich(invoice) {
    if (!invoice) return null;
    const [member, plot, dealer] = await Promise.all([
      invoice.member ? Member.findById(invoice.member) : null,
      invoice.plot ? Plot.findById(invoice.plot) : null,
      invoice.dealer ? Vendor.findById(invoice.dealer) : null,
    ]);
    return {
      ...invoice,
      memberName: member?.name || null,
      memberNumber: member?.memberId || null,
      plotNumber: plot?.plotNumber || null,
      dealerName: dealer?.name || null,
      viewUrl: invoice.fileUrl || null,
    };
  }

  static async list({
    invoiceType,
    member,
    dealer,
    plot,
    startDate,
    endDate,
    status,
    search,
    page = 1,
    limit = 20,
  } = {}) {
    const all = await Invoice.find({}, { sort: { issueDate: -1 } });
    const normalizedSearch = String(search || "").trim().toLowerCase();
    const start = startDate ? new Date(startDate).getTime() : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null;
    let filtered = all.filter((invoice) => {
      if (invoiceType && invoice.invoiceType !== invoiceType) return false;
      if (member && invoice.member !== member) return false;
      if (dealer && invoice.dealer !== dealer) return false;
      if (plot && invoice.plot !== plot) return false;
      if (status && invoice.status !== status) return false;
      const issueTime = new Date(invoice.issueDate).getTime();
      if (start && issueTime < start) return false;
      if (end && issueTime > end) return false;
      return true;
    });

    if (normalizedSearch) {
      const enriched = await Promise.all(filtered.map((invoice) => this.enrich(invoice)));
      filtered = enriched.filter((invoice) => {
        const haystack = [
          invoice.invoiceNumber,
          invoice.invoiceType,
          invoice.relatedEntityType,
          invoice.relatedEntityId,
          invoice.sourceKey,
          invoice.member,
          invoice.memberName,
          invoice.memberNumber,
          invoice.plot,
          invoice.plotNumber,
          invoice.dealer,
          invoice.dealerName,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const startIndex = (currentPage - 1) * pageSize;
    const data = await Promise.all(
      filtered.slice(startIndex, startIndex + pageSize).map((invoice) =>
        normalizedSearch ? invoice : this.enrich(invoice),
      ),
    );
    return {
      data,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: filtered.length,
        pages: Math.ceil(filtered.length / pageSize),
      },
    };
  }

  static async getById(id) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return this.enrich(invoice);
  }

  static async cancel(id, req) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status === Invoice.STATUS.CANCELLED) return this.enrich(invoice);

    const cancelledAt = new Date().toISOString();
    await Invoice.update(id, {
      status: Invoice.STATUS.CANCELLED,
      cancelledAt,
      cancelledBy: req.user._id,
    });
    await createAuditLog({
      req,
      entityType: "Invoice",
      entityId: id,
      action: AuditLog.ACTIONS.CANCEL,
      changes: { before: invoice, after: { ...invoice, status: Invoice.STATUS.CANCELLED, cancelledAt, cancelledBy: req.user._id } },
    });
    return this.getById(id);
  }
}

InvoiceService.SOURCE_CONFIG = SOURCE_CONFIG;
InvoiceService.normalizeDate = normalizeDate;

module.exports = InvoiceService;
