const Member = require("./member.model");
const { createAuditLog } = require("../../utils/auditLog");

/**
 * Member Service
 * Business logic for member management
 */
class MemberService {
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
   * Get member 360 view
   */
  static async getMember360(id) {
    const data = await Member.get360View(id);
    if (!data) {
      throw new Error("Member not found");
    }
    return data;
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
    // Check for duplicates first
    const duplicateCheck = await this.checkDuplicates({
      cnic: data.cnic,
      phone: data.phone,
    });

    // Note: We return duplicate warning but don't block creation
    // Frontend will show warning and let user confirm

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

    // Check for duplicates if CNIC or phone changed
    if (data.cnic || data.phone) {
      const duplicateCheck = await this.checkDuplicates({
        cnic: data.cnic || existingMember.cnic,
        phone: data.phone || existingMember.phone,
        excludeId: id,
      });

      if (duplicateCheck.hasDuplicates) {
        return {
          success: false,
          duplicateWarning: duplicateCheck,
        };
      }
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

    return { success: true, member: updated };
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
