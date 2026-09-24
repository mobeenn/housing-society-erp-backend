const { db } = require("../../config/db");

/**
 * Generic Master Data Model
 * Used for Blocks/Sectors, Streets, PlotCategories, PropertyTypes, Departments
 */
class MasterData {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  async find(query = {}, options = {}) {
    return await db.collection(this.collectionName).find(query, options);
  }

  async findById(id) {
    return await db.collection(this.collectionName).findOne({ _id: id });
  }

  async create(data, createdBy) {
    return await db.collection(this.collectionName).insertOne({
      name: data.name?.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async update(id, data) {
    return await db.collection(this.collectionName).updateOne(
      { _id: id },
      {
        name: data.name?.trim(),
        code: data.code?.trim(),
        description: data.description?.trim(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async archive(id) {
    return await db.collection(this.collectionName).updateOne(
      { _id: id },
      {
        isActive: false,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async restore(id) {
    return await db.collection(this.collectionName).updateOne(
      { _id: id },
      {
        isActive: true,
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }
}

// Create instances for each master data type
const Block = new MasterData("blocks");
const Street = new MasterData("streets");
const PlotCategory = new MasterData("plotCategories");
const PropertyType = new MasterData("propertyTypes");
const Department = new MasterData("departments");
const NocType = new MasterData("nocTypes");

module.exports = {
  MasterData,
  Block,
  Street,
  PlotCategory,
  PropertyType,
  Department,
  NocType,
};
