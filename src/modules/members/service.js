const Member = require("./member.model");
const { createAuditLog } = require("../../utils/auditLog");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");
const Plot = require("../properties/plot.model");
const { Booking, Installment } = require("../bookings/booking.model");
const { Payment } = require("../payments/payment.model");
const Document = require("../documents/document.model");
const { Complaint } = require("../complaints/complaint.model");
const TransferRequest = require("../transfers/transfer.model");
const NocApplication = require("../nocs/noc.model");
const PossessionApplication = require("../possession/possession.model");
const { ConstructionApplication } = require("../construction/construction.model");
const Vehicle = require("../vehicles/vehicle.model");
const { AuditLog } = require("../administration/auditLog.model");

/**
 * Member Service
 * Business logic for member management
 */
class MemberService {
  /**
   * Hard-block when another member already uses this CNIC.
   * Returns the conflicting member for the error message.
   */
  static async findCnicConflict(cnic, excludeId = null) {
    const normalized = String(cnic || "").trim();
    if (!normalized) return null;
    const matches = await Member.checkDuplicates({ cnic: normalized, phone: null, excludeId });
    return matches.find((m) => String(m.cnic || "").trim() === normalized) || null;
  }

  static assertNoCnicConflict(conflict) {
    if (!conflict) return;
    const label = conflict.memberId || conflict._id;
    throw new ApiError(
      409,
      `A member with this CNIC already exists (Member ID: ${label}). Use a different CNIC or open that member record.`,
      [{ field: "cnic", memberId: conflict.memberId, id: conflict._id }],
    );
  }

  /**
   * Get all members with pagination and search
   */
  static async getMembers(filters) {
    return await Member.search(filters);
  }

  /**
   * Get a single member by ID
   */
  static async getMemberById(id) {
    const member = await Member.findById(id);
    if (!member) {
      throw new Error("Member not found");
    }
    return member;
  }

  /**
   * Get member 360 view — sections omitted when caller lacks module view.
   */
  static async getMember360(id, user) {
    const member = await Member.findById(id);
    if (!member) throw new ApiError(404, "Member not found");

    const can = async (moduleKey) => RbacService.isAllowed(user, moduleKey, "view");

    const [
      canPlots,
      canBookings,
      canPayments,
      canDocuments,
      canComplaints,
      canTransfers,
      canNocs,
      canPossession,
      canConstruction,
      canVehicles,
      canAudit,
    ] = await Promise.all([
      can("plots"),
      can("bookings"),
      can("payments"),
      can("documents"),
      can("complaints"),
      can("transfers"),
      can("nocs"),
      can("possession"),
      can("construction"),
      can("security-vehicles"),
      can("audit"),
    ]);

    const result = {
      member,
      summary: null,
      properties: undefined,
      bookings: undefined,
      installments: undefined,
      installmentSummary: undefined,
      payments: undefined,
      documents: undefined,
      complaints: undefined,
      transfers: undefined,
      nocs: undefined,
      possessionApplications: undefined,
      constructionApplications: undefined,
      vehicles: undefined,
      auditLogs: undefined,
    };

    let installments = [];
    if (canBookings || canPayments) {
      installments = await Installment.find({ member: id }, { sort: { dueDate: 1 } });
    }

    if (canPayments || canBookings) {
      const active = installments.filter(
        (row) => !["Voided", "Cancelled", "Waived"].includes(String(row.status || ""))
      );
      const totalPayable = active.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const totalPaid = active.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
      const balance = active.reduce((sum, row) => sum + Number(row.balance || 0), 0);
      const overdueAmount = active
        .filter((row) => Number(row.balance || 0) > 0 && row.dueDate && new Date(row.dueDate) < new Date())
        .reduce((sum, row) => sum + Number(row.balance || 0), 0);
      result.summary = { totalPayable, totalPaid, balance, overdueAmount };
      result.installmentSummary = {
        total: active.length,
        paid: active.filter((row) => String(row.status) === "Paid" || Number(row.balance || 0) <= 0).length,
        overdue: active.filter(
          (row) => Number(row.balance || 0) > 0 && row.dueDate && new Date(row.dueDate) < new Date()
        ).length,
        upcoming: active.filter(
          (row) => Number(row.balance || 0) > 0 && (!row.dueDate || new Date(row.dueDate) >= new Date())
        ).length,
      };
    }

    if (canPlots) {
      const plots = await Plot.find({ currentOwner: id }, { sort: { plotNumber: 1 } });
      result.properties = plots;
    }

    if (canBookings) {
      const bookings = await Booking.find({ member: id }, { sort: { createdAt: -1 } });
      const withPlots = await Promise.all(
        bookings.map(async (booking) => ({
          ...booking,
          plotRef: booking.plot ? await Plot.findById(booking.plot) : null,
        }))
      );
      result.bookings = withPlots;
      result.installments = installments.slice(0, 50);
    }

    if (canPayments) {
      const payments = await Payment.find({ member: id }, { sort: { createdAt: -1 }, limit: 20 });
      result.payments = payments;
    }

    if (canDocuments) {
      result.documents = await Document.find(
        { relatedEntityType: "member", relatedEntityId: id },
        { sort: { createdAt: -1 }, limit: 50 }
      );
    }

    if (canComplaints) {
      result.complaints = await Complaint.find({ member: id }, { sort: { createdAt: -1 }, limit: 50 });
    }

    if (canTransfers) {
      const all = await TransferRequest.find({}, { sort: { createdAt: -1 } });
      result.transfers = all.filter((row) => row.fromMember === id || row.toMember === id).slice(0, 50);
    }

    if (canNocs) {
      result.nocs = await NocApplication.find({ member: id }, { sort: { createdAt: -1 }, limit: 50 });
    }

    if (canPossession) {
      result.possessionApplications = await PossessionApplication.find(
        { member: id },
        { sort: { createdAt: -1 }, limit: 50 }
      );
    }

    if (canConstruction) {
      result.constructionApplications = await ConstructionApplication.find(
        { member: id },
        { sort: { createdAt: -1 }, limit: 50 }
      );
    }

    if (canVehicles) {
      result.vehicles = await Vehicle.find({ owner: id }, { sort: { createdAt: -1 }, limit: 50 });
    }

    if (canAudit) {
      const logs = await AuditLog.find(
        { entityType: "Member", entityId: id },
        { sort: { createdAt: -1 }, limit: 40 }
      );
      result.auditLogs = logs;
    }

    // Drop undefined keys so FE can treat missing as "no permission"
    Object.keys(result).forEach((key) => {
      if (result[key] === undefined) delete result[key];
    });

    return result;
  }

  /**
   * Check for duplicate members
   */
  static async checkDuplicates({ cnic, phone, excludeId = null }) {
    const duplicates = await Member.checkDuplicates({ cnic, phone, excludeId });

    if (duplicates.length === 0) {
      return { hasDuplicates: false, candidates: [] };
    }

    return {
      hasDuplicates: true,
      candidates: duplicates.map((m) => ({
        _id: m._id,
        memberId: m.memberId,
        name: m.name,
        cnic: m.cnic,
        phone: m.phone,
        status: m.status,
        matchedOn: [
          cnic && m.cnic === cnic ? "CNIC" : null,
          phone && m.phone === phone ? "Phone" : null,
        ].filter(Boolean),
      })),
    };
  }

  /**
   * Create a new member
   */
  static async createMember(data, userId) {
    this.assertNoCnicConflict(await this.findCnicConflict(data.cnic));

    // Phone duplicates remain a non-blocking warning for the UI
    const duplicateCheck = await this.checkDuplicates({
      cnic: null,
      phone: data.phone,
    });

    const member = await Member.create(data, userId);

    // Audit log
    await createAuditLog({
      userId,
      action: "CREATE",
      entityType: "Member",
      entityId: member._id,
      details: {
        memberId: member.memberId,
        name: member.name,
        cnic: member.cnic,
      },
    });

    return { member, duplicateWarning: duplicateCheck };
  }

  /**
   * Update a member
   */
  static async updateMember(id, data, userId) {
    const existingMember = await Member.findById(id);
    if (!existingMember) {
      throw new Error("Member not found");
    }

    const nextCnic = data.cnic !== undefined ? data.cnic : existingMember.cnic;
    this.assertNoCnicConflict(await this.findCnicConflict(nextCnic, id));

    // Phone duplicates remain a non-blocking warning for the UI
    let duplicateWarning = { hasDuplicates: false, candidates: [] };
    if (data.phone) {
      duplicateWarning = await this.checkDuplicates({
        cnic: null,
        phone: data.phone,
        excludeId: id,
      });
    }

    const updated = await Member.update(id, data);

    // Audit log
    await createAuditLog({
      userId,
      action: "UPDATE",
      entityType: "Member",
      entityId: id,
      details: {
        memberId: existingMember.memberId,
        changes: data,
      },
    });

    return { success: true, member: updated, duplicateWarning };
  }

  /**
   * Update member status
   */
  static async updateMemberStatus(id, status, userId) {
    const member = await Member.findById(id);
    if (!member) {
      throw new Error("Member not found");
    }

    if (!Object.values(Member.STATUS).includes(status)) {
      throw new Error("Invalid status");
    }

    const updated = await Member.update(id, { status });

    // Audit log
    await createAuditLog({
      userId,
      action: "STATUS_CHANGE",
      entityType: "Member",
      entityId: id,
      details: {
        memberId: member.memberId,
        from: member.status,
        to: status,
      },
    });

    return updated;
  }

  /**
   * Delete a member (soft delete)
   */
  static async deleteMember(id, userId) {
    const member = await Member.findById(id);
    if (!member) {
      throw new Error("Member not found");
    }

    await Member.delete(id);

    // Audit log
    await createAuditLog({
      userId,
      action: "DELETE",
      entityType: "Member",
      entityId: id,
      details: {
        memberId: member.memberId,
        name: member.name,
      },
    });

    return { message: "Member deleted successfully" };
  }

  /**
   * Get member statistics
   */
  static async getStatistics() {
    return await Member.countByStatus();
  }
}

module.exports = MemberService;
