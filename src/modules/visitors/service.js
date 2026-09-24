const { VisitorEntry } = require("./visitorEntry.model");
const { Pass } = require("./pass.model");
const { BlacklistEntry } = require("./blacklist.model");
const Member = require("../members/member.model");
const User = require("../auth/user.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

/** Enrich a visitor entry with host member and guard refs. */
const enrichVisitorEntry = async (entry) => {
  const [hostMember, guard, pass] = await Promise.all([
    entry.hostMember ? Member.findById(entry.hostMember) : null,
    entry.createdBy ? User.findById(entry.createdBy) : null,
    entry.passId ? Pass.findById(entry.passId) : null,
  ]);
  return { ...entry, hostMemberRef: hostMember, guardRef: guard, passRef: pass };
};

/** Enrich a pass with related member ref. */
const enrichPass = async (pass) => {
  const [relatedMember, createdBy] = await Promise.all([
    pass.relatedMember ? Member.findById(pass.relatedMember) : null,
    pass.createdBy ? User.findById(pass.createdBy) : null,
  ]);
  return { ...pass, relatedMemberRef: relatedMember, createdByRef: createdBy };
};

class VisitorEntryService {
  /** List visitor entries with filtering and pagination. */
  static async list({ q, gate, hostMember, from, to, activeOnly, page = 1, limit = 50 } = {}) {
    const query = {};
    if (gate) query.gate = gate;
    if (hostMember) query.hostMember = hostMember;

    // Date range for entry time
    if (from || to) {
      query.entryTime = {};
      if (from) query.entryTime.$gte = from;
      if (to) query.entryTime.$lte = to;
    }

    // Active only (no exit time)
    if (activeOnly === true || activeOnly === "true") {
      query.exitTime = null;
    }

    const all = await VisitorEntry.find(query, { sort: { entryTime: -1 } });

    // Text search across name, phone, cnic, vehicle
    const filtered = q
      ? all.filter((entry) =>
          [entry.visitorName, entry.phone, entry.cnic, entry.vehicleNumber, entry.purpose]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((entry) => enrichVisitorEntry(entry))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const entry = await VisitorEntry.findById(id);
    if (!entry) throw new ApiError(404, "Visitor entry not found");
    return enrichVisitorEntry(entry);
  }

  /** Create a visitor entry with blacklist checking. */
  static async create(data, req) {
    // Validate host member if provided
    if (data.hostMember) {
      const member = await Member.findById(data.hostMember);
      if (!member) throw new ApiError(400, "Host member not found");
    }

    // Validate pass if provided
    if (data.passId) {
      const pass = await Pass.findById(data.passId);
      if (!pass) throw new ApiError(400, "Pass not found");
      if (pass.status !== "Active") throw new ApiError(400, "Pass is not active");

      // Check pass validity
      const today = new Date().toISOString().split("T")[0];
      if (pass.validTo < today) throw new ApiError(400, "Pass has expired");
    }

    // Check blacklist
    const blacklistCheck = await this.checkBlacklist({
      name: data.visitorName,
      cnic: data.cnic,
      phone: data.phone,
      vehicleNumber: data.vehicleNumber,
    });

    if (blacklistCheck.blocked) {
      throw new ApiError(403, `Visitor is blacklisted: ${blacklistCheck.reason}. Entry blocked.`);
    }

    const entry = await VisitorEntry.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "VisitorEntry",
      entityId: entry._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: entry, blacklistWarning: blacklistCheck.warning },
    });

    const enriched = await this.get(entry._id);

    // Return with blacklist warning if applicable
    return blacklistCheck.warning
      ? { ...enriched, blacklistWarning: blacklistCheck.warning }
      : enriched;
  }

  /** Mark exit for a visitor entry. */
  static async markExit(id, data, req) {
    const entry = await VisitorEntry.findById(id);
    if (!entry) throw new ApiError(404, "Visitor entry not found");
    if (entry.exitTime) throw new ApiError(400, "Exit already marked");

    const exitTime = data.exitTime || new Date().toISOString();
    await VisitorEntry.update(id, {
      exitTime,
      exitMarkedBy: req.user._id,
      remarks: data.remarks || entry.remarks,
    });

    await createAuditLog({
      req,
      entityType: "VisitorEntry",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: { exitTime: null }, after: { exitTime } },
    });

    return this.get(id);
  }

  /** Check if a visitor matches any blacklist entry. */
  static async checkBlacklist({ name, cnic, phone, vehicleNumber }) {
    const activeBlacklist = await BlacklistEntry.find({ status: "Active" });

    for (const entry of activeBlacklist) {
      const matches = [];
      if (entry.name && name && entry.name.toLowerCase() === name.toLowerCase()) {
        matches.push("name");
      }
      if (entry.cnic && cnic && entry.cnic === cnic) {
        matches.push("CNIC");
      }
      if (entry.phone && phone && entry.phone === phone) {
        matches.push("phone");
      }
      if (entry.vehicleNumber && vehicleNumber &&
          entry.vehicleNumber.toUpperCase() === vehicleNumber.toUpperCase()) {
        matches.push("vehicle");
      }

      if (matches.length > 0) {
        const message = `Blacklisted (${matches.join(", ")}): ${entry.reason}`;
        if (entry.action === "Block") {
          return { blocked: true, reason: entry.reason, matches };
        } else {
          return { warning: message, matches };
        }
      }
    }

    return { blocked: false, warning: null };
  }
}

class PassService {
  static async list({ q, type, status, relatedMember, page = 1, limit = 50 } = {}) {
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (relatedMember) query.relatedMember = relatedMember;

    const all = await Pass.find(query, { sort: { createdAt: -1 } });

    const filtered = q
      ? all.filter((pass) =>
          [pass.passNumber, pass.holderName, pass.phone, pass.cnic]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((pass) => enrichPass(pass))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const pass = await Pass.findById(id);
    if (!pass) throw new ApiError(404, "Pass not found");
    return enrichPass(pass);
  }

  static async create(data, req) {
    // Validate related member if provided
    if (data.relatedMember) {
      const member = await Member.findById(data.relatedMember);
      if (!member) throw new ApiError(400, "Related member not found");
    }

    // Check for duplicate pass number
    const existing = await Pass.findOne({ passNumber: data.passNumber });
    if (existing) throw new ApiError(400, "Pass number already exists");

    // Validate date range
    if (data.validFrom >= data.validTo) {
      throw new ApiError(400, "validTo must be after validFrom");
    }

    const pass = await Pass.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "Pass",
      entityId: pass._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: pass },
    });

    return this.get(pass._id);
  }

  static async update(id, data, req) {
    const pass = await Pass.findById(id);
    if (!pass) throw new ApiError(404, "Pass not found");

    const patch = {};
    ["status", "validTo", "notes"].forEach((field) => {
      if (data[field] !== undefined) patch[field] = data[field];
    });

    await Pass.update(id, patch);
    await createAuditLog({
      req,
      entityType: "Pass",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: pass, after: patch },
    });

    return this.get(id);
  }

  static async delete(id, req) {
    const pass = await Pass.findById(id);
    if (!pass) throw new ApiError(404, "Pass not found");

    await Pass.delete(id);
    await createAuditLog({
      req,
      entityType: "Pass",
      entityId: id,
      action: AuditLog.ACTIONS.DELETE,
      changes: { before: pass },
    });

    return { success: true };
  }
}

class BlacklistService {
  static async list({ q, status, page = 1, limit = 50 } = {}) {
    const query = {};
    if (status) query.status = status;

    const all = await BlacklistEntry.find(query, { sort: { createdAt: -1 } });

    const filtered = q
      ? all.filter((entry) =>
          [entry.name, entry.cnic, entry.phone, entry.vehicleNumber, entry.reason]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: slice,
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const entry = await BlacklistEntry.findById(id);
    if (!entry) throw new ApiError(404, "Blacklist entry not found");
    return entry;
  }

  static async create(data, req) {
    const entry = await BlacklistEntry.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "BlacklistEntry",
      entityId: entry._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: entry },
    });

    return entry;
  }

  static async update(id, data, req) {
    const entry = await BlacklistEntry.findById(id);
    if (!entry) throw new ApiError(404, "Blacklist entry not found");

    const patch = {};
    ["status", "reason", "action"].forEach((field) => {
      if (data[field] !== undefined) patch[field] = data[field];
    });

    await BlacklistEntry.update(id, patch);
    await createAuditLog({
      req,
      entityType: "BlacklistEntry",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: entry, after: patch },
    });

    return this.get(id);
  }

  static async delete(id, req) {
    const entry = await BlacklistEntry.findById(id);
    if (!entry) throw new ApiError(404, "Blacklist entry not found");

    await BlacklistEntry.delete(id);
    await createAuditLog({
      req,
      entityType: "BlacklistEntry",
      entityId: id,
      action: AuditLog.ACTIONS.DELETE,
      changes: { before: entry },
    });

    return { success: true };
  }
}

class SecurityReportsService {
  /** Generate security activity report. */
  static async getActivityReport({ from, to, gate } = {}) {
    const query = {};
    if (gate) query.gate = gate;
    if (from || to) {
      query.entryTime = {};
      if (from) query.entryTime.$gte = from;
      if (to) query.entryTime.$lte = to;
    }

    const entries = await VisitorEntry.find(query);

    const totalVisits = entries.length;
    const activeVisits = entries.filter((e) => !e.exitTime).length;
    const completedVisits = entries.filter((e) => e.exitTime).length;

    const vehicleEntries = entries.filter((e) => e.vehicleNumber).length;

    const gateBreakdown = {};
    entries.forEach((e) => {
      gateBreakdown[e.gate] = (gateBreakdown[e.gate] || 0) + 1;
    });

    const purposeBreakdown = {};
    entries.forEach((e) => {
      purposeBreakdown[e.purpose] = (purposeBreakdown[e.purpose] || 0) + 1;
    });

    return {
      period: { from, to },
      summary: {
        totalVisits,
        activeVisits,
        completedVisits,
        vehicleEntries,
      },
      gateBreakdown,
      purposeBreakdown,
    };
  }
}

module.exports = {
  VisitorEntryService,
  PassService,
  BlacklistService,
  SecurityReportsService,
};
