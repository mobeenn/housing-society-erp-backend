const InventoryItem = require("./model");

class InventoryService {
  static async list() {
    const items = await InventoryItem.find({}, { sort: { name: 1 } });
    return items.map((item) => ({
      ...item,
      lowStock: Number(item.quantity || 0) <= Number(item.reorderLevel || 0),
      shortage: Math.max(0, Number(item.reorderLevel || 0) - Number(item.quantity || 0)),
    }));
  }

  static async lowStock() {
    const items = await this.list();
    return {
      generatedAt: new Date().toISOString(),
      count: items.filter((item) => item.lowStock).length,
      items: items.filter((item) => item.lowStock),
    };
  }
}

module.exports = InventoryService;
