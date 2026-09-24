const { Guard } = require("./guard.model");
const { DutyRoster } = require("./dutyRoster.model");
const { ATTENDANCE_STATUSES } = require("./security.config");
const User = require("../auth/user.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

/** Enrich a guard with user/supervisor refs. */
const enrichGuard = async (guard) => {
  const [user, supervisor] = await Promise.all([
    guard.user ? User.findById(guard.user) : null,
    guard.supervisor ? User.findById(guard.supervisor) : null,
  ]);
  return { ...guard, userRef: user, supervisorRef: supervisor };
};

class GuardService {
  static async list({ q, status, shift, page = 1, limit = 50 } = {}) {
    const query = {};
    if (status) query.status = status;
    if (shift) query.shift = shift;
    const all = await Guard.find(query, { sort: { name: 1 } });
    const filtered = q
      ? all.filter((guard) =>
          [guard.name, guard.phone, guard.shift]
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
      data: await Promise.all(slice.map((guard) => enrichGuard(guard))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const guard = await Guard.findById(id);
    if (!guard) throw new ApiError(404, "Guard not found");
    return enrichGuard(guard);
  }

  static async create(data, req) {
    if (data.user && !(await User.findById(data.user))) {
      throw new ApiError(400, "Linked user not found");
    }
    if (data.supervisor && !(await User.findById(data.supervisor))) {
      throw new ApiError(400, "Supervisor user not found");
    }
    const guard = await Guard.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "Guard",
      entityId: guard._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: guard },
    });
    return this.get(guard._id);
  }

  static async update(id, data, req) {
    const guard = await Guard.findById(id);
    if (!guard) throw new ApiError(404, "Guard not found");
    if (data.user && !(await User.findById(data.user))) {
      throw new ApiError(400, "Linked user not found");
    }
    if (data.supervisor && !(await User.findById(data.supervisor))) {
      throw new ApiError(400, "Supervisor user not found");
    }
    const patch = { updatedAt: new Date().toISOString() };
    ["user", "name", "phone", "supervisor", "shift", "status"].forEach((field) => {
      if (data[field] !== undefined) patch[field] = data[field];
    });
    await Guard.update(id, patch);
    await createAuditLog({
      req,
      entityType: "Guard",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: guard, after: patch },
    });
    return this.get(id);
  }
}

class RosterService {
  static async enrichEntry(entry) {
    const guard = entry.guard ? await Guard.findById(entry.guard) : null;
    return { ...entry, guardRef: guard };
  }

  /**
   * Duty roster for a date range (defaults to the current week).
   * Returns enriched entries plus the roster summary per attendance status.
   */
  static async list({ from, to, guard } = {}) {
    const now = new Date();
    const start = from || new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000)
      .toISOString().slice(0, 10); // Monday of the current week
    const end = to || new Date(new Date(start).getTime() + 6 * 86400000)
      .toISOString().slice(0, 10); // Sunday
    const query = { date: { $gte: start, $lte: end } };
    if (guard) query.guard = guard;
    const entries = await DutyRoster.find(query, { sort: { date: 1 } });
    const enriched = await Promise.all(entries.map((entry) => this.enrichEntry(entry)));
    const summary = {};
    ATTENDANCE_STATUSES.forEach((status) => {
      summary[status] = enriched.filter((entry) => entry.attendanceStatus === status).length;
    });
    return {
      data: enriched,
      range: { from: start, to: end },
      summary: { ...summary, Unmarked: enriched.filter((e) => !e.attendanceStatus).length },
    };
  }

  /** Assign (upsert) a guard's shift for a date — one entry per guard+date. */
  static async assign(data, req) {
    const guard = await Guard.findById(data.guard);
    if (!guard) throw new ApiError(400, "Guard not found");
    const existing = await DutyRoster.findOne({ guard: data.guard, date: data.date });
    const now = new Date().toISOString();
    if (existing) {
      await DutyRoster.update(existing._id, {
        shift: data.shift,
        updatedAt: now,
      });
      await createAuditLog({
        req,
        entityType: "DutyRoster",
        entityId: existing._id,
        action: AuditLog.ACTIONS.UPDATE,
        changes: { before: { shift: existing.shift }, after: { shift: data.shift } },
      });
    } else {
      const entry = await DutyRoster.create({ ...data }, req.user._id);
      await createAuditLog({
        req,
        entityType: "DutyRoster",
        entityId: entry._id,
        action: AuditLog.ACTIONS.CREATE,
        changes: { after: entry },
      });
    }
    return this.getEntry(data.guard, data.date);
  }

  /** Mark attendance for a guard on a date (upserts the roster entry). */
  static async markAttendance(data, req) {
    const guard = await Guard.findById(data.guard);
    if (!guard) throw new ApiError(400, "Guard not found");
    const now = new Date().toISOString();
    const existing = await DutyRoster.findOne({ guard: data.guard, date: data.date });
    if (existing) {
      await DutyRoster.update(existing._id, {
        attendanceStatus: data.attendanceStatus,
        updatedAt: now,
      });
      await createAuditLog({
        req,
        entityType: "DutyRoster",
        entityId: existing._id,
        action: AuditLog.ACTIONS.UPDATE,
        changes: {
          before: { attendanceStatus: existing.attendanceStatus },
          after: { attendanceStatus: data.attendanceStatus },
        },
      });
    } else {
      const entry = await DutyRoster.create(
        {
          guard: data.guard,
          date: data.date,
          shift: guard.shift, // default to the guard's regular shift
          attendanceStatus: data.attendanceStatus,
        },
        req.user._id
      );
      await createAuditLog({
        req,
        entityType: "DutyRoster",
        entityId: entry._id,
        action: AuditLog.ACTIONS.CREATE,
        changes: { after: entry },
      });
    }
    return this.getEntry(data.guard, data.date);
  }

  static async getEntry(guardId, date) {
    const entry = await DutyRoster.findOne({ guard: guardId, date });
    if (!entry) throw new ApiError(404, "Roster entry not found");
    return this.enrichEntry(entry);
  }
}

module.exports = { GuardService, RosterService };