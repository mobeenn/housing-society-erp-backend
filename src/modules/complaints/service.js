const { Complaint } = require("./complaint.model");
const {
  STATUSES,
  OPEN_STATUSES,
  CATEGORY_KEYS,
  computeSlaDueDate,
  canTransitionStatus,
  getCategoryConfig,
  isOverdue,
} = require("./complaint.config");
const NumberingRule = require("../administration/numberingRule.model");
const { Department } = require("../administration/masterData.model");
const { Plot } = require("../properties/plot.model");
const Member = require("../members/member.model");
const User = require("../auth/user.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");
const NotificationService = require("../notifications/service");

/** Auto-assignment rule: default department per category (resolved from master data code). */
const resolveDefaultDepartment = async (category) => {
  const { defaultDepartmentCode } = getCategoryConfig(category);
  const departments = await Department.find({});
  return (
    departments.find((dept) => dept.code === defaultDepartmentCode) ||
    departments.find((dept) => dept.name === defaultDepartmentCode) ||
    null
  );
};

const nextComplaintNumber = async () => {
  try {
    return await NumberingRule.getNextNumber(NumberingRule.ENTITY_TYPES.COMPLAINT);
  } catch (error) {
    return null; // numbering rule not seeded — complaint number is optional
  }
};

class ComplaintService {
  static async enrich(complaint) {
    const authorIds = [...new Set((complaint.comments || []).map((c) => c.author))];
    const [member, plot, department, staff, ...authors] = await Promise.all([
      Member.findById(complaint.member),
      complaint.plot ? Plot.findById(complaint.plot) : null,
      complaint.assignedDepartment ? Department.findById(complaint.assignedDepartment) : null,
      complaint.assignedStaff ? User.findById(complaint.assignedStaff) : null,
      ...authorIds.map((id) => User.findById(id)),
    ]);
    const authorMap = new Map(authorIds.map((id, i) => [id, authors[i]]));
    const overdue = isOverdue(complaint);
    const slaRemainingMs = complaint.slaDueDate
      ? new Date(complaint.slaDueDate).getTime() - Date.now()
      : null;
    return {
      ...complaint,
      memberRef: member,
      plotRef: plot,
      assignedDepartmentRef: department,
      assignedStaffRef: staff,
      comments: (complaint.comments || []).map((comment) => ({
        ...comment,
        authorRef: authorMap.get(comment.author) || null,
      })),
      isOverdue: overdue,
      slaRemainingMs,
    };
  }

  static async list({ status, priority, category, page = 1, limit = 20 }) {
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    const all = await Complaint.find(query, { sort: { createdAt: -1 } });
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    return {
      data: await Promise.all(all.slice((p - 1) * l, p * l).map((c) => this.enrich(c))),
      pagination: { page: p, limit: l, total: all.length, pages: Math.ceil(all.length / l) },
    };
  }

  static async get(id) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    return this.enrich(complaint);
  }

  /** File a complaint — computes SLA due date and auto-assigns the default department. */
  static async create(data, req) {
    if (!(await Member.findById(data.member))) throw new ApiError(400, "Member not found");
    if (data.plot) {
      const plot = await Plot.findById(data.plot);
      if (!plot) throw new ApiError(400, "Plot not found");
    }
    if (!CATEGORY_KEYS.includes(data.category)) throw new ApiError(400, `Unknown complaint category: ${data.category}`);
    const defaultDepartment = await resolveDefaultDepartment(data.category);
    const complaint = await Complaint.create(
      {
        ...data,
        complaintNumber: await nextComplaintNumber(),
        assignedDepartment: defaultDepartment?._id || null,
        slaDueDate: computeSlaDueDate(data.category, data.priority),
      },
      req.user._id
    );
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: complaint._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: complaint },
    });
    await NotificationService.safeNotifyPermission("complaints:assign", {
      title: "New complaint requires assignment",
      message: `${complaint.complaintNumber} was filed and is waiting for assignment.`,
      relatedEntityType: "Complaint",
      relatedEntityId: complaint._id,
      eventType: "complaint.created",
      eventKey: `complaint-created:${complaint._id}`,
    });
    await NotificationService.safeNotifyMember(complaint.member, {
      title: "Complaint received",
      message: `Your complaint ${complaint.complaintNumber} has been registered.`,
      relatedEntityType: "Complaint",
      relatedEntityId: complaint._id,
      eventType: "complaint.created.member",
      eventKey: `complaint-created-member:${complaint._id}`,
    });
    return this.get(complaint._id);
  }

  /** Assign / reassign department + staff. New/Reopened -> Assigned. */
  static async assign(id, data, req) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    if ([STATUSES.RESOLVED, STATUSES.CLOSED].includes(complaint.status)) {
      throw new ApiError(409, "Cannot assign a resolved or closed complaint");
    }
    if (data.assignedDepartment && !(await Department.findById(data.assignedDepartment))) {
      throw new ApiError(400, "Department not found");
    }
    if (data.assignedStaff && !(await User.findById(data.assignedStaff))) {
      throw new ApiError(400, "Staff user not found");
    }
    const patch = { updatedAt: new Date().toISOString() };
    if (data.assignedDepartment) patch.assignedDepartment = data.assignedDepartment;
    if (data.assignedStaff !== undefined) patch.assignedStaff = data.assignedStaff || null;
    if ([STATUSES.NEW, STATUSES.REOPENED].includes(complaint.status)) {
      if (!canTransitionStatus(complaint.status, STATUSES.ASSIGNED)) {
        throw new ApiError(409, `Cannot move complaint from ${complaint.status} to Assigned`);
      }
      patch.status = STATUSES.ASSIGNED;
    }
    await Complaint.update(id, patch);
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: complaint, after: patch },
    });
    if (patch.assignedStaff) {
      await NotificationService.safeNotifyUsers([patch.assignedStaff], {
        title: "Complaint assigned to you",
        message: `${complaint.complaintNumber} has been assigned to you.`,
        relatedEntityType: "Complaint",
        relatedEntityId: id,
        eventType: "complaint.assigned",
        eventKey: `complaint-assigned:${id}:${patch.assignedStaff}`,
      });
    }
    await NotificationService.safeNotifyMember(complaint.member, {
      title: "Complaint assignment updated",
      message: `${complaint.complaintNumber} is now ${patch.status || complaint.status}.`,
      relatedEntityType: "Complaint",
      relatedEntityId: id,
      eventType: "complaint.assigned.member",
      eventKey: `complaint-assigned-member:${id}`,
    });
    return this.get(id);
  }

  /** Add a comment to the complaint thread. */
  static async addComment(id, data, req) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    const comment = {
      author: req.user._id,
      text: data.text.trim(),
      createdAt: new Date().toISOString(),
    };
    await Complaint.update(id, {
      comments: [...(complaint.comments || []), comment],
      updatedAt: new Date().toISOString(),
    });
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { after: { comment } },
    });
    return this.get(id);
  }

  /** change-status with transition validation (Resolved is handled by resolve()). */
  static async changeStatus(id, data, req) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    if (data.status === STATUSES.RESOLVED) {
      throw new ApiError(409, "Use the resolve endpoint to resolve a complaint");
    }
    if (!canTransitionStatus(complaint.status, data.status)) {
      throw new ApiError(409, `Invalid status transition: ${complaint.status} -> ${data.status}`);
    }
    await Complaint.update(id, { status: data.status, updatedAt: new Date().toISOString() });
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before: { status: complaint.status }, after: { status: data.status } },
    });
    await NotificationService.safeNotifyMember(complaint.member, {
      title: "Complaint status updated",
      message: `${complaint.complaintNumber} moved to ${data.status}.`,
      relatedEntityType: "Complaint",
      relatedEntityId: id,
      eventType: "complaint.statusChanged",
      eventKey: `complaint-status:${id}:${data.status}`,
    });
    if (complaint.assignedStaff) {
      await NotificationService.safeNotifyUsers([complaint.assignedStaff], {
        title: "Complaint status updated",
        message: `${complaint.complaintNumber} moved to ${data.status}.`,
        relatedEntityType: "Complaint",
        relatedEntityId: id,
        eventType: "complaint.statusChanged.staff",
        eventKey: `complaint-status-staff:${id}:${data.status}`,
      });
    }
    return this.get(id);
  }

  /** Resolve a complaint — requires a resolution note. */
  static async resolve(id, data, req) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    if (!canTransitionStatus(complaint.status, STATUSES.RESOLVED)) {
      throw new ApiError(409, `Cannot resolve a complaint in status ${complaint.status}`);
    }
    if (!data.resolutionNote?.trim()) throw new ApiError(400, "Resolution note is required");
    const resolvedAt = new Date().toISOString();
    await Complaint.update(id, {
      status: STATUSES.RESOLVED,
      resolutionNote: data.resolutionNote.trim(),
      resolvedAt,
      updatedAt: resolvedAt,
    });
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before: { status: complaint.status }, after: { status: STATUSES.RESOLVED } },
    });
    await NotificationService.safeNotifyMember(complaint.member, {
      title: "Complaint resolved",
      message: `${complaint.complaintNumber} has been resolved.`,
      relatedEntityType: "Complaint",
      relatedEntityId: id,
      eventType: "complaint.resolved",
      eventKey: `complaint-resolved:${id}`,
    });
    if (complaint.assignedStaff) {
      await NotificationService.safeNotifyUsers([complaint.assignedStaff], {
        title: "Complaint resolved",
        message: `${complaint.complaintNumber} has been resolved.`,
        relatedEntityType: "Complaint",
        relatedEntityId: id,
        eventType: "complaint.resolved.staff",
        eventKey: `complaint-resolved-staff:${id}`,
      });
    }
    return this.get(id);
  }

  /** Reopen a resolved/closed complaint (validates the transition). */
  static async reopen(id, req) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw new ApiError(404, "Complaint not found");
    if (!canTransitionStatus(complaint.status, STATUSES.REOPENED)) {
      throw new ApiError(409, `Cannot reopen a complaint in status ${complaint.status}`);
    }
    await Complaint.update(id, {
      status: STATUSES.REOPENED,
      resolvedAt: null,
      updatedAt: new Date().toISOString(),
    });
    await createAuditLog({
      req,
      entityType: "Complaint",
      entityId: id,
      action: AuditLog.ACTIONS.STATUS_CHANGE,
      changes: { before: { status: complaint.status }, after: { status: STATUSES.REOPENED } },
    });
    await NotificationService.safeNotifyMember(complaint.member, {
      title: "Complaint reopened",
      message: `${complaint.complaintNumber} has been reopened for further action.`,
      relatedEntityType: "Complaint",
      relatedEntityId: id,
      eventType: "complaint.reopened",
      eventKey: `complaint-reopened:${id}`,
    });
    return this.get(id);
  }
}

module.exports = ComplaintService;
module.exports.OPEN_STATUSES = OPEN_STATUSES;