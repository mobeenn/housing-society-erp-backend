const { db } = require("../../config/db");

/**
 * NumberingRule Model
 * Manages auto-incrementing sequence numbers for various entities
 */
class NumberingRule {
  static collectionName = "numberingRules";

  static ENTITY_TYPES = {
    MEMBER: "member",
    PLOT: "plot",
    RECEIPT: "receipt",
    APPLICATION: "application",
    NOC: "noc",
    DOCUMENT: "document",
    INVOICE: "invoice",
    PAYMENT: "payment",
    COMPLAINT: "complaint",
    PURCHASE_REQUEST: "purchaseRequest",
    QUOTATION: "quotation",
    PURCHASE_ORDER: "purchaseOrder",
    APPOINTMENT: "appointment",
    GRN: "grn",
  };

  static RESET_POLICIES = {
    NEVER: "never",
    DAILY: "daily",
    YEARLY: "yearly",
    MONTHLY: "monthly",
  };

  /**
   * Find all numbering rules
   */
  static async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  /**
   * Find one numbering rule by entity type
   */
  static async findByEntityType(entityType) {
    return await db.collection(this.collectionName).findOne({ entityType });
  }

  /**
   * Create a new numbering rule
   */
  static async create(data) {
    return await db.collection(this.collectionName).insertOne({
      entityType: data.entityType,
      prefix: data.prefix?.trim() || "",
      currentSequence: data.currentSequence || 0,
      padLength: data.padLength || 6,
      resetPolicy: data.resetPolicy || this.RESET_POLICIES.NEVER,
      lastResetAt: data.lastResetAt || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Update a numbering rule
   */
  static async update(id, data) {
    return await db.collection(this.collectionName).updateOne(
      { _id: id },
      {
        prefix: data.prefix?.trim(),
        padLength: data.padLength,
        resetPolicy: data.resetPolicy,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Atomically get the next sequence number and format it
   * This is the core method used by all modules
   */
  static async getNextNumber(entityType) {
    const rule = await this.findByEntityType(entityType);

    if (!rule) {
      throw new Error(`No numbering rule defined for entity type: ${entityType}`);
    }

    const now = new Date();
    const shouldReset = this._shouldResetSequence(rule, now);

    let newSequence = shouldReset ? 1 : rule.currentSequence + 1;

    // Atomically increment the sequence
    const updated = await db.collection(this.collectionName).findOneAndUpdate(
      { entityType },
      {
        currentSequence: newSequence,
        lastResetAt: shouldReset ? now.toISOString() : rule.lastResetAt,
        updatedAt: now.toISOString(),
      },
      { returnDocument: "after" }
    );

    return this._formatNumber(updated);
  }

  /**
   * Format a number according to the rule
   */
  static _formatNumber(rule) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const sequence = String(rule.currentSequence).padStart(rule.padLength, "0");

    let formatted = rule.prefix;

    if (rule.resetPolicy === this.RESET_POLICIES.DAILY) {
      const day = String(now.getDate()).padStart(2, "0");
      formatted += `-${year}${month}${day}`;
    } else if (rule.resetPolicy === this.RESET_POLICIES.YEARLY) {
      formatted += `-${year}`;
    } else if (rule.resetPolicy === this.RESET_POLICIES.MONTHLY) {
      formatted += `-${year}${month}`;
    }

    formatted += `-${sequence}`;

    return formatted;
  }

  /**
   * Check if sequence should reset based on policy
   */
  static _shouldResetSequence(rule, now) {
    if (rule.resetPolicy === this.RESET_POLICIES.NEVER) {
      return false;
    }

    if (!rule.lastResetAt) {
      return true;
    }

    const lastReset = new Date(rule.lastResetAt);

    if (rule.resetPolicy === this.RESET_POLICIES.DAILY) {
      return now.toDateString() !== lastReset.toDateString();
    }

    if (rule.resetPolicy === this.RESET_POLICIES.YEARLY) {
      return now.getFullYear() > lastReset.getFullYear();
    }

    if (rule.resetPolicy === this.RESET_POLICIES.MONTHLY) {
      return (
        now.getFullYear() > lastReset.getFullYear() ||
        now.getMonth() > lastReset.getMonth()
      );
    }

    return false;
  }
}

module.exports = NumberingRule;
