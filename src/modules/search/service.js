const { db } = require("../../config/db");
const RbacService = require("../rbac/service");

const SEARCH_CONFIG = [
  { type: "member", label: "Members", module: "members", collection: "members", fields: ["name", "memberId", "cnic", "phone", "email"], title: (item) => item.name, subtitle: (item) => `${item.memberId} · ${item.phone || item.email || "No contact"}`, route: (item) => `/members/${item._id}` },
  { type: "plot", label: "Plots", module: "plots", collection: "plots", fields: ["plotNumber", "fileNumber", "location"], title: (item) => item.plotNumber, subtitle: (item) => `${item.location || "Plot"} · ${item.status}`, route: (item) => `/plots/${item._id}` },
  { type: "booking", label: "Bookings", module: "bookings", collection: "bookings", fields: ["bookingDate", "status"], title: (item) => `Booking ${item._id}`, subtitle: (item) => item.status, route: (item) => `/bookings/${item._id}` },
  { type: "payment", label: "Receipts", module: "payments", collection: "payments", fields: ["receiptNumber", "method", "status"], title: (item) => item.receiptNumber, subtitle: (item) => `${item.method} · PKR ${Number(item.amount || 0).toLocaleString()}`, route: (item) => `/payments/${item._id}` },
  { type: "complaint", label: "Complaints", module: "complaints", collection: "complaints", fields: ["complaintNumber", "description", "category", "status"], title: (item) => item.complaintNumber, subtitle: (item) => `${item.category} · ${item.status}`, route: (item) => `/complaints/${item._id}` },
  { type: "transfer", label: "Transfers", module: "transfers", collection: "transferRequests", fields: ["type", "status"], title: (item) => `Transfer ${item._id}`, subtitle: (item) => item.status, route: (item) => `/transfers/${item._id}` },
  { type: "noc", label: "NOCs", module: "nocs", collection: "nocApplications", fields: ["issuedNocNumber", "nocType", "status"], title: (item) => item.issuedNocNumber || `NOC ${item._id}`, subtitle: (item) => `${item.nocType} · ${item.status}`, route: (item) => `/nocs/${item._id}` },
  { type: "possession", label: "Possession", module: "possession", collection: "possessionApplications", fields: ["status"], title: (item) => `Possession ${item._id}`, subtitle: (item) => item.status, route: (item) => `/possession/${item._id}` },
  { type: "construction", label: "Construction", module: "construction", collection: "constructionApplications", fields: ["applicationType", "status"], title: (item) => `Construction ${item._id}`, subtitle: (item) => `${item.applicationType} · ${item.status}`, route: (item) => `/construction/${item._id}` },
  { type: "workOrder", label: "Work Orders", module: "maintenance", collection: "workOrders", fields: ["description", "status", "priority"], title: (item) => `Work order ${item._id}`, subtitle: (item) => `${item.priority} · ${item.status}`, route: (item) => `/maintenance/${item._id}` },
  { type: "vehicle", label: "Vehicles", module: "security-vehicles", collection: "vehicles", fields: ["number", "model", "stickerNumber", "status"], title: (item) => item.number, subtitle: (item) => `${item.model} · ${item.status}`, route: () => "/security/vehicles" },
  { type: "pass", label: "Passes", module: "visitors", collection: "passes", fields: ["passNumber", "holderName", "phone", "cnic", "status"], title: (item) => item.passNumber, subtitle: (item) => `${item.holderName} · ${item.status}`, route: () => "/security/visitors/passes" },
  { type: "document", label: "Documents", module: "documents", collection: "documents", fields: ["name", "fileName", "originalName", "number", "mimeType"], title: (item) => item.name || item.fileName || item.originalName || `Document ${item._id}`, subtitle: (item) => item.mimeType || "Document", route: () => "/documents" },
  { type: "notice", label: "Notices", module: "notices", collection: "notices", fields: ["title", "body", "status"], title: (item) => item.title, subtitle: (item) => item.body?.slice(0, 90), route: () => "/notices" },
  { type: "vendor", label: "Vendors", module: "procurement", collection: "vendors", fields: ["name", "contactPerson", "email", "category"], title: (item) => item.name, subtitle: (item) => `${item.category} · ${item.contactPerson || "No contact"}`, route: () => "/procurement/vendors" },
];

const PER_COLLECTION_LIMIT = 10;
/** DateTime columns cannot use Prisma `contains` (how $regex is mapped). */
const NON_TEXT_FIELDS = new Set(["bookingDate", "createdAt", "updatedAt", "date", "dueDate", "entryTime"]);

class SearchService {
  static score(item, fields, query) {
    const normalized = query.toLowerCase();
    let best = 0;
    for (const field of fields) {
      const value = item[field];
      if (value === null || value === undefined) continue;
      const text = String(value).toLowerCase();
      if (text === normalized) best = Math.max(best, 100);
      else if (text.startsWith(normalized)) best = Math.max(best, 80);
      else if (text.includes(normalized)) best = Math.max(best, 55);
    }
    if (!best) return 0;
    const recency = item.updatedAt || item.createdAt || item.date || "";
    const ageDays = recency ? Math.max(0, (Date.now() - new Date(recency).getTime()) / 86400000) : 9999;
    return best + Math.max(0, 10 - ageDays / 30);
  }

  static async searchCollection(config, query) {
    const textFields = config.fields.filter((field) => !NON_TEXT_FIELDS.has(field));
    if (!textFields.length) return [];
    const filter = {
      $or: textFields.map((field) => ({ [field]: { $regex: query, $options: "i" } })),
    };
    return db.collection(config.collection).find(filter, {
      limit: PER_COLLECTION_LIMIT,
      sort: { updatedAt: -1 },
    });
  }

  static async allowedConfigs(user) {
    const allowed = [];
    for (const config of SEARCH_CONFIG) {
      if (await RbacService.isAllowed(user, config.module, "view")) {
        allowed.push(config);
      }
    }
    return allowed;
  }

  static async search(q, limit = 30, user = null) {
    const query = String(q || "").trim();
    if (query.length < 2) return { query, total: 0, groups: [], items: [] };
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));

    const configs = user ? await this.allowedConfigs(user) : [];
    if (!configs.length) {
      return { query, total: 0, groups: [], items: [] };
    }

    const collections = await Promise.all(configs.map((config) => this.searchCollection(config, query)));
    const results = [];

    configs.forEach((config, index) => {
      for (const item of collections[index]) {
        const score = this.score(item, config.fields, query);
        if (!score) continue;
        results.push({
          _id: item._id,
          type: config.type,
          typeLabel: config.label,
          title: config.title(item),
          subtitle: config.subtitle(item),
          route: config.route(item),
          score,
          updatedAt: item.updatedAt || item.createdAt || item.date || null,
        });
      }
    });

    results.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const limited = results.slice(0, safeLimit);
    const groups = configs.map((config) => ({
      type: config.type,
      label: config.label,
      items: limited.filter((item) => item.type === config.type),
    })).filter((group) => group.items.length);
    return { query, total: results.length, groups, items: limited };
  }
}

module.exports = SearchService;
module.exports.SEARCH_CONFIG = SEARCH_CONFIG;
