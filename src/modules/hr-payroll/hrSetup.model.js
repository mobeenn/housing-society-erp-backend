const { db } = require("../../config/db");

const SETUP_ID = "default";

const defaultSetup = () => ({
  _id: SETUP_ID,
  salaryComponents: [
    { name: "Basic Salary", type: "Earning", calculationType: "Fixed" },
    { name: "Housing Allowance", type: "Earning", calculationType: "Fixed" },
    { name: "Medical Allowance", type: "Earning", calculationType: "Fixed" },
  ],
  statutoryConfig: {
    eobiPercent: 0,
    providentFundPercent: 0,
  },
  taxSlabs: [],
});

class HRSetup {
  static collectionName = "hrSetups";

  static async get() {
    const existing = await db.collection(this.collectionName).findOne({ _id: SETUP_ID });
    if (existing) return existing;
    return (await db.collection(this.collectionName).insertOne(defaultSetup()));
  }

  static async update(data, updatedBy = null) {
    const current = await this.get();
    const next = {
      ...current,
      ...data,
      _id: SETUP_ID,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
    await db.collection(this.collectionName).updateOne({ _id: SETUP_ID }, next);
    return this.get();
  }
}

module.exports = HRSetup;
module.exports.SETUP_ID = SETUP_ID;
module.exports.defaultSetup = defaultSetup;
