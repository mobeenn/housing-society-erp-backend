const { db } = require("../../config/db");
const NumberingRule = require("../administration/numberingRule.model");

/**
 * Member Model
 * Represents housing society members
 */
class Member {
  static collectionName = "members";

  static STATUS = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    BLACKLISTED: "Blacklisted",
  };

  /**
   * Find all members with optional filters
   */
  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  /**
   * Find one member by ID
   */
  static async findById(id) {
    return await db.collection(this.collectionName).findOne({ _id: id });
  }

  /**
   * Find one member by query
   */
  static async findOne(query) {
    return await db.collection(this.collectionName).findOne(query);
  }

  /**
   * Search members with pagination
   */
  static async search({ search, status, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    let query = {};

    // Status filter
    if (status && this.STATUS[status.toUpperCase()]) {
      query.status = status;
    }

    // Search across multiple fields
    if (search?.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      query.$or = [
        { memberId: searchRegex },
        { name: searchRegex },
        { cnic: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    const [results, total] = await Promise.all([
      db.collection(this.collectionName).find(query, {
        skip,
        limit,
        sort: { createdAt: -1 },
      }),
      db.collection(this.collectionName).count(query),
    ]);

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Check for duplicate CNIC or phone
   */
  static async checkDuplicates({ cnic, phone, excludeId = null }) {
    const conditions = [];

    if (cnic?.trim()) {
      conditions.push({ cnic: cnic.trim() });
    }

    if (phone?.trim()) {
      conditions.push({ phone: phone.trim() });
    }

    if (conditions.length === 0) {
      return [];
    }

    const query = { $or: conditions };

    // Exclude current member if updating
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    return await db.collection(this.collectionName).find(query);
  }

  /**
   * Create a new member
   */
  static async create(data, createdBy) {
    // Generate memberId using NumberingRule
    const memberId = await NumberingRule.getNextNumber(NumberingRule.ENTITY_TYPES.MEMBER);

    const member = {
      memberId,
      name: data.name.trim(),
      cnic: data.cnic.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      userId: data.userId || null,
      nominee: data.nominee
        ? {
            name: data.nominee.name?.trim() || null,
            relation: data.nominee.relation?.trim() || null,
            cnic: data.nominee.cnic?.trim() || null,
          }
        : null,
      status: data.status || this.STATUS.ACTIVE,
      photo: data.photo || null,
      documents: data.documents || [],
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await db.collection(this.collectionName).insertOne(member);
  }

  /**
   * Update a member
   */
  static async update(id, data) {
    const updateData = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.cnic !== undefined) updateData.cnic = data.cnic.trim();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;
    if (data.address !== undefined) updateData.address = data.address?.trim() || null;
    if (data.userId !== undefined) updateData.userId = data.userId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.documents !== undefined) updateData.documents = data.documents;

    if (data.nominee !== undefined) {
      updateData.nominee = data.nominee
        ? {
            name: data.nominee.name?.trim() || null,
            relation: data.nominee.relation?.trim() || null,
            cnic: data.nominee.cnic?.trim() || null,
          }
        : null;
    }

    return await db.collection(this.collectionName).updateOne({ _id: id }, updateData);
  }

  /**
   * Delete a member (soft delete by setting status to Inactive)
   */
  static async delete(id) {
    return await db.collection(this.collectionName).updateOne(
      { _id: id },
      {
        status: this.STATUS.INACTIVE,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Get member 360 view (aggregated data from all modules)
   */
  static async get360View(id) {
    const member = await this.findById(id);
    if (!member) {
      return null;
    }

    // TODO: As modules are built, aggregate data from:
    // - Properties/Plots assigned to this member
    // - Bookings made by this member
    // - Installments linked to this member
    // - Payments made by this member
    // - Transfer requests by/to this member
    // - NOCs issued to this member
    // - Complaints filed by this member
    // - Documents uploaded for this member
    // - Audit logs related to this member

    return {
      member,
      properties: [], // Placeholder - will be populated when Plots module is built
      bookings: [], // Placeholder - will be populated when Bookings module is built
      installments: [], // Placeholder - will be populated when Financials module is built
      payments: [], // Placeholder - will be populated when Payments module is built
      transfers: [], // Placeholder - will be populated when Transfers module is built
      nocs: [], // Placeholder - will be populated when NOCs module is built
      complaints: [], // Placeholder - will be populated when Complaints module is built
      documents: [], // Placeholder - will be populated when Documents module is built
      auditLogs: [], // Placeholder - will be populated when full audit integration is ready
    };
  }

  /**
   * Count members by status
   */
  static async countByStatus() {
    const members = await this.find({});

    return {
      total: members.length,
      active: members.filter((m) => m.status === this.STATUS.ACTIVE).length,
      inactive: members.filter((m) => m.status === this.STATUS.INACTIVE).length,
      blacklisted: members.filter((m) => m.status === this.STATUS.BLACKLISTED).length,
    };
  }
}

module.exports = Member;
