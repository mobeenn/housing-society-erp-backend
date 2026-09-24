const { db } = require("../../config/db");

/**
 * SocietySettings Model
 * Singleton document containing global society configuration
 */
class SocietySettings {
  static collectionName = "societySettings";

  /**
   * Get the singleton society settings document
   */
  static async get() {
    const settings = await db.collection(this.collectionName).findOne({});
    if (!settings) return this.getDefaults();
    const defaults = this.getDefaults();
    return {
      ...defaults,
      ...settings,
      recoveryAutoBlockThreshold: Number.isFinite(Number(settings.recoveryAutoBlockThreshold))
        ? Number(settings.recoveryAutoBlockThreshold)
        : defaults.recoveryAutoBlockThreshold,
      recoveryAllowSelfReserve: settings.recoveryAllowSelfReserve === true,
    };
  }

  /**
   * Update society settings
   */
  static async update(data) {
    const existing = await db.collection(this.collectionName).findOne({});

    if (existing) {
      return await db.collection(this.collectionName).updateOne(
        { _id: existing._id },
        {
          name: data.name?.trim(),
          logo: data.logo || null,
          address: data.address || {},
          fiscalYear: data.fiscalYear || {},
          currency: data.currency || "PKR",
          feeSettings: data.feeSettings || {},
          recoveryAutoBlockThreshold: data.recoveryAutoBlockThreshold ?? existing.recoveryAutoBlockThreshold ?? 49,
          recoveryAllowSelfReserve: data.recoveryAllowSelfReserve ?? existing.recoveryAllowSelfReserve ?? false,
          contactInfo: data.contactInfo || {},
          updatedAt: new Date().toISOString(),
        }
      );
    } else {
      return await db.collection(this.collectionName).insertOne({
        name: data.name?.trim(),
        logo: data.logo || null,
        address: data.address || {},
        fiscalYear: data.fiscalYear || {},
        currency: data.currency || "PKR",
        feeSettings: data.feeSettings || {},
        recoveryAutoBlockThreshold: data.recoveryAutoBlockThreshold ?? 49,
        recoveryAllowSelfReserve: data.recoveryAllowSelfReserve ?? false,
        contactInfo: data.contactInfo || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Default settings structure
   */
  static getDefaults() {
    return {
      name: "Housing Society",
      logo: null,
      address: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Pakistan",
      },
      fiscalYear: {
        startMonth: 7, // July
        startDay: 1,
      },
      currency: "PKR",
      feeSettings: {
        lateFeePercentage: 0,
        lateFeeDaysGrace: 0,
        penaltyRule: { type: "flat", amount: 0, period: "day", graceDays: 0 },
      },
      recoveryAutoBlockThreshold: 49,
      recoveryAllowSelfReserve: false,
      contactInfo: {
        phone: "",
        email: "",
        website: "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

module.exports = SocietySettings;
