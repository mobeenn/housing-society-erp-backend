const ExcelJS = require("exceljs");
const { db } = require("../../config/db");
const { Booking, Installment } = require("../bookings/booking.model");
const Member = require("../members/member.model");
const { Plot } = require("../properties/plot.model");
const User = require("../auth/user.model");
const SocietySettings = require("../administration/societySettings.model");
const NotificationService = require("../notifications/service");
const RbacService = require("../rbac/service");
const ApiError = require("../../utils/ApiError");
const { RecoveryAssignment, RecoveryCall } = require("./recovery.model");

const DAY_MS = 24 * 60 * 60 * 1000;
let lastAutoBlockRunAt = 0;
let lastAutoBlockThreshold = null;
let autoBlockRunPromise = null;

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const optionalNumber = (value) => value === undefined || value === null || value === "" ? null : number(value);
const clampPercent = (value) => Math.max(0, Math.min(100, value));
const unique = (values = []) => [...new Set((values || []).filter(Boolean))];

function startOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysOverdue(installment, now = new Date()) {
  if (installment.dueDate) {
    const due = new Date(`${String(installment.dueDate).slice(0, 10)}T00:00:00.000Z`);
    return Math.max(0, Math.floor((startOfToday(now) - due) / DAY_MS));
  }
  return Math.max(0, Math.floor(number(installment.overdueDays)));
}

function installmentDue(installment) {
  return Math.max(0, number(installment.amount) + number(installment.penaltyAmount) - number(installment.discountAmount));
}

function installmentPaid(installment) {
  if (installment.paidAmount !== undefined && installment.paidAmount !== null) return number(installment.paidAmount);
  return Math.max(0, number(installment.amount) - number(installment.balance));
}

function installmentBalance(installment) {
  if (installment.balance !== undefined && installment.balance !== null) return number(installment.balance);
  return Math.max(0, installmentDue(installment) - installmentPaid(installment));
}

function isOverdueInstallment(installment, now = new Date()) {
  if (installmentBalance(installment) <= 0) return false;
  if (installment.dueDate) return daysOverdue(installment, now) > 0;
  const status = String(installment.status || "").toLowerCase();
  return status === "overdue" || number(installment.overdueDays) > 0;
}

async function loadContext() {
  const [bookings, installments, plans, members, plots] = await Promise.all([
    Booking.find({}),
    Installment.find({}),
    db.collection("installmentPlans").find({}),
    Member.find({}),
    Plot.find({}),
  ]);
  return {
    bookings,
    installments,
    plans: new Map(plans.map((plan) => [plan._id, plan])),
    members: new Map(members.map((member) => [member._id, member])),
    plots: new Map(plots.map((plot) => [plot._id, plot])),
  };
}

function bookingIdForInstallment(installment, context) {
  return installment.booking || context.plans.get(installment.plan)?.booking || null;
}

function paginate(rows, page = 1, limit = 20, maxPageSize = 100) {
  const currentPage = Math.max(1, number(page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, number(limit) || 20));
  const start = (currentPage - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize),
    pagination: {
      page: currentPage,
      limit: pageSize,
      total: rows.length,
      pages: Math.ceil(rows.length / pageSize),
    },
  };
}

class RecoveryService {
  static async getSettings() {
    const settings = await SocietySettings.get();
    const rawThreshold = settings.recoveryAutoBlockThreshold;
    const parsedThreshold = rawThreshold === undefined || rawThreshold === null || rawThreshold === "" ? NaN : Number(rawThreshold);
    const configured = Number.isFinite(parsedThreshold) ? parsedThreshold : 49;
    return {
      autoBlockThreshold: clampPercent(configured),
      allowSelfReserve: settings.recoveryAllowSelfReserve === true,
    };
  }

  static summarizeBooking(bookingId, context, now = new Date()) {
    const booking = context.bookings.find((item) => item._id === bookingId);
    if (!booking || booking.status === Booking.STATUS.CANCELLED) return null;
    const installments = context.installments.filter((item) => bookingIdForInstallment(item, context) === bookingId);
    const totalDue = installments.reduce((sum, item) => sum + installmentDue(item), 0);
    const paidAmount = installments.reduce((sum, item) => sum + Math.min(installmentPaid(item), installmentDue(item)), 0);
    const overdueInstallments = installments.filter((item) => isOverdueInstallment(item, now));
    const outstandingAmount = installments.reduce((sum, item) => sum + Math.max(0, installmentBalance(item)), 0);
    const daysOverdueValue = overdueInstallments.reduce((max, item) => Math.max(max, daysOverdue(item, now)), 0);
    const recoveryPercent = totalDue > 0 ? clampPercent((paidAmount / totalDue) * 100) : 100;
    const member = context.members.get(booking.member) || null;
    const plot = context.plots.get(booking.plot) || null;

    return {
      bookingId,
      bookingRef: booking,
      member,
      plot,
      installments,
      overdueInstallments,
      totalDue,
      paidAmount,
      outstandingAmount,
      recoveryPercent,
      daysOverdue: daysOverdueValue,
      isOverdue: overdueInstallments.length > 0 && outstandingAmount > 0,
      isBlocked: Boolean(plot?.isBlocked),
    };
  }

  static async getBookingSummaries({ onlyOverdue = false } = {}) {
    const context = await loadContext();
    return context.bookings
      .map((booking) => this.summarizeBooking(booking._id, context))
      .filter((summary) => summary && (!onlyOverdue || summary.isOverdue));
  }

  static async getActiveAssignment(bookingId) {
    return RecoveryAssignment.findActiveByBooking(bookingId);
  }

  static async enrichAssignment(assignment, context = null) {
    const activeContext = context || await loadContext();
    const summary = this.summarizeBooking(assignment.booking, activeContext);
    const [agent, assignedBy, calls] = await Promise.all([
      User.findById(assignment.agent),
      User.findById(assignment.assignedBy),
      RecoveryCall.findByAssignment(assignment._id),
    ]);
    return {
      ...assignment,
      recoveryPercent: summary?.recoveryPercent ?? number(assignment.recoveryPercent),
      totalDue: summary?.totalDue ?? 0,
      paidAmount: summary?.paidAmount ?? 0,
      outstandingAmount: summary?.outstandingAmount ?? 0,
      daysOverdue: summary?.daysOverdue ?? 0,
      bookingRef: summary?.bookingRef || null,
      memberRef: summary?.member || null,
      plotRef: summary?.plot || null,
      agentRef: agent ? { _id: agent._id, name: agent.name, email: agent.email } : null,
      assignedByRef: assignedBy ? { _id: assignedBy._id, name: assignedBy.name, email: assignedBy.email } : null,
      callCount: calls.length,
      calls,
      isBlocked: Boolean(summary?.plot?.isBlocked),
    };
  }

  static async isSupervisor(user) {
    return RbacService.isSuperAdmin(user) || await RbacService.isAllowed(user, "recovery", "create");
  }

  static async getAssignmentForUser(id, user) {
    const assignment = await RecoveryAssignment.findById(id);
    if (!assignment) throw new ApiError(404, "Recovery assignment not found");
    const supervisor = await this.isSupervisor(user);
    if (assignment.agent !== user._id && !supervisor) throw new ApiError(403, "You cannot access another agent's recovery assignment");
    return assignment;
  }

  static async listPool({
    page = 1,
    limit = 20,
    search = "",
    minDaysOverdue,
    maxDaysOverdue,
    maxRecoveryPercent,
    minRecoveryPercent,
  } = {}) {
    await this.runAutoBlockCheck();
    const context = await loadContext();
    const query = String(search || "").trim().toLowerCase();
    const minDays = number(minDaysOverdue);
    const maxDays = optionalNumber(maxDaysOverdue);
    const maxPercent = optionalNumber(maxRecoveryPercent);
    const minPercent = optionalNumber(minRecoveryPercent);
    const rows = [];

    for (const booking of context.bookings) {
      const summary = this.summarizeBooking(booking._id, context);
      if (!summary?.isOverdue) continue;
      if (await this.getActiveAssignment(booking._id)) continue;
      if (minDays > 0 && summary.daysOverdue < minDays) continue;
      if (maxDays !== null && summary.daysOverdue > maxDays) continue;
      if (maxPercent !== null && summary.recoveryPercent > maxPercent) continue;
      if (minPercent !== null && summary.recoveryPercent < minPercent) continue;
      const haystack = [summary.bookingId, summary.member?.name, summary.member?.memberId, summary.plot?.plotNumber, summary.plot?.fileNumber]
        .filter(Boolean).join(" ").toLowerCase();
      if (query && !haystack.includes(query)) continue;
      rows.push({
        ...summary,
        assignment: null,
      });
    }

    rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstandingAmount - a.outstandingAmount);
    const result = paginate(rows, page, limit);
    return { ...result, settings: await this.getSettings() };
  }

  static async assign({ agentId, agent: agentAlias, bookingIds, bookingId }, req) {
    const targetAgentId = agentId || agentAlias;
    const agent = await User.findById(targetAgentId);
    if (!agent || agent.isActive !== true) throw new ApiError(400, "Active recovery agent not found");
    await User.populate(agent, "roles");
    if (!RbacService.isSuperAdmin(agent) && !await RbacService.isAllowed(agent, "recovery", "edit")) {
      throw new ApiError(400, "Selected user does not have recovery agent access");
    }
    const ids = unique([...(bookingIds || []), ...(bookingId ? [bookingId] : [])]);
    if (!ids.length) throw new ApiError(400, "At least one booking is required");

    const context = await loadContext();
    const assigned = [];
    const skipped = [];
    for (const id of ids) {
      const summary = this.summarizeBooking(id, context);
      if (!summary?.isOverdue) {
        skipped.push({ bookingId: id, reason: "Booking is not overdue" });
        continue;
      }
      if (await this.getActiveAssignment(id)) {
        skipped.push({ bookingId: id, reason: "Booking already has an active assignment" });
        continue;
      }
      const assignment = await RecoveryAssignment.create({
        booking: id,
        agent: agent._id,
        assignedBy: req.user._id,
        recoveryPercent: summary.recoveryPercent,
      });
      await NotificationService.safeNotifyUsers([agent._id], {
        title: "Recovery plot assigned",
        message: `Booking ${id} has been assigned to you for recovery follow-up.`,
        relatedEntityType: "RecoveryAssignment",
        relatedEntityId: assignment._id,
        eventType: "recovery.assignment.created",
        eventKey: `recovery-assigned:${assignment._id}:${agent._id}`,
        metadata: { booking: id },
        createdBy: req.user._id,
      });
      assigned.push(await this.enrichAssignment(assignment, context));
    }
    return { assigned, skipped, agent: { _id: agent._id, name: agent.name, email: agent.email } };
  }

  static async reserve(id, req) {
    const settings = await this.getSettings();
    if (!settings.allowSelfReserve) throw new ApiError(409, "Self-reservation is disabled; ask a supervisor to assign this plot");
    const existing = await RecoveryAssignment.findById(id);
    const bookingId = existing?.booking || id;
    const context = await loadContext();
    const summary = this.summarizeBooking(bookingId, context);
    if (!summary?.isOverdue) throw new ApiError(409, "Booking is not overdue");
    if (await this.getActiveAssignment(bookingId)) throw new ApiError(409, "Booking has already been reserved");
    const assignment = await RecoveryAssignment.create({
      booking: bookingId,
      agent: req.user._id,
      assignedBy: req.user._id,
      recoveryPercent: summary.recoveryPercent,
    });
    return this.enrichAssignment(assignment, context);
  }

  static async reassign(id, agentId, req) {
    const assignment = await RecoveryAssignment.findById(id);
    if (!assignment) throw new ApiError(404, "Recovery assignment not found");
    if (![RecoveryAssignment.STATUS.ASSIGNED, RecoveryAssignment.STATUS.IN_PROGRESS].includes(assignment.status)) {
      throw new ApiError(409, "Only active assignments can be reassigned");
    }
    const agent = await User.findById(agentId);
    if (!agent || agent.isActive !== true) throw new ApiError(400, "Active recovery agent not found");
    await User.populate(agent, "roles");
    if (!RbacService.isSuperAdmin(agent) && !await RbacService.isAllowed(agent, "recovery", "edit")) {
      throw new ApiError(400, "Selected user does not have recovery agent access");
    }
    await RecoveryAssignment.update(id, { status: RecoveryAssignment.STATUS.REASSIGNED });
    const context = await loadContext();
    const summary = this.summarizeBooking(assignment.booking, context);
    const replacement = await RecoveryAssignment.create({
      booking: assignment.booking,
      agent: agent._id,
      assignedBy: req.user._id,
      recoveryPercent: summary?.recoveryPercent ?? 0,
    });
    return { previous: { ...assignment, status: RecoveryAssignment.STATUS.REASSIGNED }, assignment: await this.enrichAssignment(replacement, context) };
  }

  static async resolve(id, req) {
    const assignment = await RecoveryAssignment.findById(id);
    if (!assignment) throw new ApiError(404, "Recovery assignment not found");
    if (assignment.agent !== req.user._id && !(await this.isSupervisor(req.user))) throw new ApiError(403, "You cannot resolve another agent's assignment");
    const context = await loadContext();
    const summary = this.summarizeBooking(assignment.booking, context);
    await RecoveryAssignment.update(id, { status: RecoveryAssignment.STATUS.RESOLVED, recoveryPercent: summary?.recoveryPercent ?? assignment.recoveryPercent });
    return this.enrichAssignment(await RecoveryAssignment.findById(id), context);
  }

  static async listMyPlots(user, { page = 1, limit = 50 } = {}) {
    await this.runAutoBlockCheck();
    const assignments = await RecoveryAssignment.findByAgent(user._id);
    const context = await loadContext();
    const rows = (await Promise.all(assignments.map((assignment) => this.enrichAssignment(assignment, context))))
      .filter((row) => row.status !== RecoveryAssignment.STATUS.REASSIGNED)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstandingAmount - a.outstandingAmount);
    return paginate(rows, page, limit);
  }

  static async listAssignments({ status, agent, page = 1, limit = 50 } = {}) {
    await this.runAutoBlockCheck();
    let assignments = await RecoveryAssignment.find({});
    if (status) assignments = assignments.filter((item) => item.status === status);
    if (agent) assignments = assignments.filter((item) => item.agent === agent);
    const context = await loadContext();
    const rows = await Promise.all(assignments.map((assignment) => this.enrichAssignment(assignment, context)));
    rows.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));
    return paginate(rows, page, limit);
  }

  static async getAgents() {
    const users = await User.find({ isActive: true });
    const result = [];
    for (const user of users) {
      await User.populate(user, "roles");
      if (!RbacService.isSuperAdmin(user) && !await RbacService.isAllowed(user, "recovery", "edit")) continue;
      result.push({
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: (user.roles || []).map((role) => typeof role === "string" ? role : role.name).filter(Boolean),
      });
    }
    return result;
  }

  static async getCalls(id, user) {
    const assignment = await this.getAssignmentForUser(id, user);
    const calls = await RecoveryCall.findByAssignment(assignment._id);
    const callerIds = unique(calls.map((call) => call.calledBy));
    const callers = new Map();
    for (const callerId of callerIds) {
      const caller = await User.findById(callerId);
      if (caller) callers.set(callerId, { _id: caller._id, name: caller.name, email: caller.email });
    }
    return {
      assignment: await this.enrichAssignment(assignment),
      data: calls.map((call) => ({ ...call, calledByRef: callers.get(call.calledBy) || null })),
    };
  }

  static async addCall(id, data, req) {
    const assignment = await this.getAssignmentForUser(id, req.user);
    const call = await RecoveryCall.create({ ...data, assignment: id, calledBy: req.user._id });
    if (assignment.status === RecoveryAssignment.STATUS.ASSIGNED) {
      await RecoveryAssignment.update(id, { status: RecoveryAssignment.STATUS.IN_PROGRESS });
    }
    return { call, assignment: await this.enrichAssignment(await RecoveryAssignment.findById(id)) };
  }

  static commitmentKept(call, summary, now = new Date()) {
    if (!call.commitmentDate || !Number.isFinite(Number(call.commitmentAmount))) return false;
    if (new Date(call.commitmentDate).getTime() > now.getTime()) return false;
    return number(summary?.paidAmount) >= number(call.commitmentAmount);
  }

  static async performanceForAgent(agentId) {
    const assignments = await RecoveryAssignment.findByAgent(agentId);
    const context = await loadContext();
    const rows = await Promise.all(assignments.map((assignment) => this.enrichAssignment(assignment, context)));
    const calls = await RecoveryCall.findByCalledBy(agentId);
    const commitments = [];
    for (const call of calls) {
      if (!call.commitmentDate) continue;
      const assignment = assignments.find((item) => item._id === call.assignment);
      const summary = assignment ? this.summarizeBooking(assignment.booking, context) : null;
      commitments.push({ ...call, kept: this.commitmentKept(call, summary) });
    }
    return {
      summary: {
        assignedPlots: rows.filter((row) => row.status !== RecoveryAssignment.STATUS.REASSIGNED).length,
        callsMade: calls.length,
        amountRecovered: rows.reduce((sum, row) => sum + number(row.paidAmount), 0),
        outstandingAmount: rows.reduce((sum, row) => sum + number(row.outstandingAmount), 0),
        commitmentsKept: commitments.filter((item) => item.kept).length,
        commitments: commitments.length,
      },
      assignments: rows,
      commitments,
    };
  }

  static async myPerformance(user) {
    return this.performanceForAgent(user._id);
  }

  static async teamPerformance() {
    const assignments = await RecoveryAssignment.find({});
    const context = await loadContext();
    const agentIds = unique(assignments.map((assignment) => assignment.agent));
    const agents = [];
    for (const agentId of agentIds) {
      const agent = await User.findById(agentId);
      const performance = await this.performanceForAgent(agentId);
      agents.push({ agent: agent ? { _id: agent._id, name: agent.name, email: agent.email } : { _id: agentId, name: "Unknown agent" }, ...performance });
    }
    agents.sort((a, b) => b.summary.amountRecovered - a.summary.amountRecovered);
    return {
      data: agents,
      summary: {
        agents: agents.length,
        assignedPlots: assignments.length,
        callsMade: agents.reduce((sum, item) => sum + item.summary.callsMade, 0),
        amountRecovered: agents.reduce((sum, item) => sum + item.summary.amountRecovered, 0),
        commitmentsKept: agents.reduce((sum, item) => sum + item.summary.commitmentsKept, 0),
      },
    };
  }

  static async listOverdue(user, {
    page = 1,
    limit = 20,
    search = "",
    minDaysOverdue,
    maxDaysOverdue,
    maxRecoveryPercent,
    minRecoveryPercent,
    internal = false,
  } = {}) {
    await this.runAutoBlockCheck();
    const supervisor = await this.isSupervisor(user);
    const context = await loadContext();
    const assignedBookings = supervisor ? null : new Set((await RecoveryAssignment.findByAgent(user._id)).filter((item) => [RecoveryAssignment.STATUS.ASSIGNED, RecoveryAssignment.STATUS.IN_PROGRESS].includes(item.status)).map((item) => item.booking));
    const query = String(search || "").trim().toLowerCase();
    const minDays = number(minDaysOverdue);
    const maxDays = optionalNumber(maxDaysOverdue);
    const maxPercent = optionalNumber(maxRecoveryPercent);
    const minPercent = optionalNumber(minRecoveryPercent);
    const rows = [];
    for (const booking of context.bookings) {
      if (assignedBookings && !assignedBookings.has(booking._id)) continue;
      const summary = this.summarizeBooking(booking._id, context);
      if (!summary?.isOverdue) continue;
      if (minDays > 0 && summary.daysOverdue < minDays) continue;
      if (maxDays !== null && summary.daysOverdue > maxDays) continue;
      if (maxPercent !== null && summary.recoveryPercent > maxPercent) continue;
      if (minPercent !== null && summary.recoveryPercent < minPercent) continue;
      for (const installment of summary.overdueInstallments) {
        const row = {
          ...installment,
          bookingId: summary.bookingId,
          bookingRef: summary.bookingRef,
          memberRef: summary.member,
          plotRef: summary.plot,
          totalDue: summary.totalDue,
          paidAmount: summary.paidAmount,
          recoveryPercent: summary.recoveryPercent,
          daysOverdue: daysOverdue(installment),
          outstandingAmount: installmentBalance(installment),
          isBlocked: summary.isBlocked,
          assignment: await this.getActiveAssignment(summary.bookingId),
        };
        const haystack = [row._id, row.bookingId, row.memberRef?.name, row.memberRef?.memberId, row.plotRef?.plotNumber, row.plotRef?.fileNumber]
          .filter(Boolean).join(" ").toLowerCase();
        if (query && !haystack.includes(query)) continue;
        rows.push(row);
      }
    }
    rows.sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstandingAmount - a.outstandingAmount);
    const result = paginate(rows, page, limit, internal ? 10000 : 100);
    return {
      ...result,
      summary: {
        installmentCount: rows.length,
        bookingCount: new Set(rows.map((row) => row.bookingId)).size,
        totalOutstanding: rows.reduce((sum, row) => sum + number(row.outstandingAmount), 0),
      },
      scope: supervisor ? "all" : "assigned",
    };
  }

  static async sendReminders(bookingIds, req) {
    const ids = unique(bookingIds);
    if (!ids.length) throw new ApiError(400, "At least one booking is required");
    const context = await loadContext();
    const supervisor = await this.isSupervisor(req.user);
    const assignedBookings = supervisor ? null : new Set((await RecoveryAssignment.findByAgent(req.user._id)).filter((item) => [RecoveryAssignment.STATUS.ASSIGNED, RecoveryAssignment.STATUS.IN_PROGRESS].includes(item.status)).map((item) => item.booking));
    const results = [];
    const eventDate = new Date().toISOString().slice(0, 10);
    for (const bookingId of ids) {
      if (assignedBookings && !assignedBookings.has(bookingId)) {
        results.push({ bookingId, sent: false, reason: "Booking is not assigned to this agent" });
        continue;
      }
      const summary = this.summarizeBooking(bookingId, context);
      if (!summary?.isOverdue || !summary.member) {
        results.push({ bookingId, sent: false, reason: "No overdue member record" });
        continue;
      }
      const notification = await NotificationService.safeNotifyMember(summary.member._id, {
        title: "Overdue installment reminder",
        message: `Your booking ${summary.bookingRef?._id || bookingId} has an overdue balance of PKR ${number(summary.outstandingAmount).toLocaleString()}. Please contact the society office to arrange payment.`,
        relatedEntityType: "Booking",
        relatedEntityId: bookingId,
        eventType: "recovery.reminder",
        eventKey: `recovery-reminder:${bookingId}:${eventDate}`,
        metadata: { outstandingAmount: summary.outstandingAmount, overdueDays: summary.daysOverdue },
        createdBy: req.user._id,
      });
      results.push({ bookingId, sent: Boolean(notification), notificationId: notification?._id || null });
    }
    return { data: results, sent: results.filter((item) => item.sent).length };
  }

  static async exportOverdue(user, filters = {}) {
    const result = await this.listOverdue(user, { ...filters, page: 1, limit: 10000, internal: true });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Overdue Installments");
    sheet.columns = [
      { header: "Booking ID", key: "bookingId", width: 28 },
      { header: "Member", key: "member", width: 24 },
      { header: "Plot", key: "plot", width: 18 },
      { header: "Due Date", key: "dueDate", width: 16 },
      { header: "Amount", key: "amount", width: 16 },
      { header: "Paid", key: "paidAmount", width: 16 },
      { header: "Outstanding", key: "outstandingAmount", width: 16 },
      { header: "Overdue Days", key: "daysOverdue", width: 14 },
      { header: "Recovery %", key: "recoveryPercent", width: 14 },
      { header: "Status", key: "status", width: 16 },
    ];
    result.data.forEach((row) => sheet.addRow({
      bookingId: row.bookingId,
      member: `${row.memberRef?.name || ""} (${row.memberRef?.memberId || ""})`,
      plot: row.plotRef?.plotNumber || "",
      dueDate: row.dueDate,
      amount: number(row.amount),
      paidAmount: number(row.paidAmount),
      outstandingAmount: number(row.outstandingAmount),
      daysOverdue: number(row.daysOverdue),
      recoveryPercent: number(row.recoveryPercent).toFixed(2),
      status: row.status,
    }));
    sheet.getRow(1).font = { bold: true };
    return workbook.xlsx.writeBuffer();
  }

  static async runAutoBlockCheck({ force = false } = {}) {
    if (autoBlockRunPromise) return autoBlockRunPromise;
    autoBlockRunPromise = (async () => {
      const settings = await this.getSettings();
      if (!force && Date.now() - lastAutoBlockRunAt < 23 * 60 * 60 * 1000 && lastAutoBlockThreshold === settings.autoBlockThreshold) {
        return { skipped: true };
      }
      const context = await loadContext();
      let blocked = 0;
      let unblocked = 0;
      let checked = 0;
      for (const booking of context.bookings) {
        const summary = this.summarizeBooking(booking._id, context);
        const plot = summary?.plot || context.plots.get(booking.plot);
        const shouldBlock = Boolean(summary?.isOverdue && summary.recoveryPercent <= settings.autoBlockThreshold);
        if (summary?.isOverdue) checked += 1;
        if (!plot) continue;
        if (plot.isBlocked === undefined) {
          await Plot.update(plot._id, { isBlocked: shouldBlock });
          if (shouldBlock) blocked += 1;
          else unblocked += 1;
          continue;
        }
        if (Boolean(plot.isBlocked) === shouldBlock) continue;
        await Plot.update(plot._id, { isBlocked: shouldBlock });
        if (shouldBlock) blocked += 1;
        else unblocked += 1;
      }
      for (const plot of context.plots.values()) {
        if (plot.isBlocked !== undefined) continue;
        await Plot.update(plot._id, { isBlocked: false });
        unblocked += 1;
      }
      lastAutoBlockRunAt = Date.now();
      lastAutoBlockThreshold = settings.autoBlockThreshold;
      return { checked, blocked, unblocked, threshold: settings.autoBlockThreshold };
    })().finally(() => { autoBlockRunPromise = null; });
    return autoBlockRunPromise;
  }
}

RecoveryService.DAY_MS = DAY_MS;
RecoveryService.isOverdueInstallment = isOverdueInstallment;
RecoveryService.daysOverdue = daysOverdue;
module.exports = RecoveryService;
