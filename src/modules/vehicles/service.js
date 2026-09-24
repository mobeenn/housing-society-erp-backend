const { Vehicle } = require("./vehicle.model");
const Member = require("../members/member.model");
const { createAuditLog, AuditLog } = require("../administration/auditLog.model");
const ApiError = require("../../utils/ApiError");

/** Enrich a vehicle with its owner reference. */
const enrichVehicle = async (vehicle) => {
  if (!vehicle.owner) return { ...vehicle, ownerRef: null };
  const owner = await Member.findById(vehicle.owner);
  return { ...vehicle, ownerRef: owner };
};

class VehicleService {
  static async list({ q, status, type, owner, page = 1, limit = 50 } = {}) {
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (owner) query.owner = owner;

    const all = await Vehicle.find(query, { sort: { number: 1 } });
    const filtered = q
      ? all.filter((vehicle) =>
          [vehicle.number, vehicle.model, vehicle.stickerNumber]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(String(q).toLowerCase())
        )
      : all;

    const p = Number(page) || 1;
    const l = Number(limit) || 50;
    const slice = filtered.slice((p - 1) * l, p * l);

    return {
      data: await Promise.all(slice.map((vehicle) => enrichVehicle(vehicle))),
      pagination: {
        page: p,
        limit: l,
        total: filtered.length,
        pages: Math.ceil(filtered.length / l),
      },
    };
  }

  static async get(id) {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) throw new ApiError(404, "Vehicle not found");
    return enrichVehicle(vehicle);
  }

  static async create(data, req) {
    // Check if vehicle number already exists
    const existing = await Vehicle.findOne({ number: data.number.trim().toUpperCase() });
    if (existing) {
      throw new ApiError(400, "Vehicle number already registered");
    }

    // Validate owner if provided
    if (data.owner) {
      const owner = await Member.findById(data.owner);
      if (!owner) throw new ApiError(400, "Owner (member) not found");
    }

    const vehicle = await Vehicle.create(data, req.user._id);
    await createAuditLog({
      req,
      entityType: "Vehicle",
      entityId: vehicle._id,
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: vehicle },
    });

    return this.get(vehicle._id);
  }

  static async update(id, data, req) {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) throw new ApiError(404, "Vehicle not found");

    // Check for duplicate number if updating
    if (data.number) {
      const duplicate = await Vehicle.findOne({
        number: data.number.trim().toUpperCase()
      });
      if (duplicate && duplicate._id !== id) {
        throw new ApiError(400, "Vehicle number already registered");
      }
    }

    // Validate owner if provided
    if (data.owner !== undefined && data.owner !== null) {
      const owner = await Member.findById(data.owner);
      if (!owner) throw new ApiError(400, "Owner (member) not found");
    }

    const patch = { updatedAt: new Date().toISOString() };
    ["owner", "number", "type", "model", "stickerNumber", "status"].forEach((field) => {
      if (data[field] !== undefined) {
        patch[field] = data[field];
        if (field === "number" && data[field]) {
          patch[field] = data[field].trim().toUpperCase();
        }
      }
    });

    await Vehicle.update(id, patch);
    await createAuditLog({
      req,
      entityType: "Vehicle",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: { before: vehicle, after: patch },
    });

    return this.get(id);
  }

  static async delete(id, req) {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) throw new ApiError(404, "Vehicle not found");

    await Vehicle.delete(id);
    await createAuditLog({
      req,
      entityType: "Vehicle",
      entityId: id,
      action: AuditLog.ACTIONS.DELETE,
      changes: { before: vehicle },
    });

    return { success: true };
  }

  /** Issue or update a sticker number for a vehicle. */
  static async issueSticker(id, stickerNumber, req) {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) throw new ApiError(404, "Vehicle not found");

    const now = new Date().toISOString();
    await Vehicle.update(id, {
      stickerNumber: stickerNumber.trim(),
      stickerIssuedAt: now,
      updatedAt: now,
    });

    await createAuditLog({
      req,
      entityType: "Vehicle",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: {
        before: { stickerNumber: vehicle.stickerNumber },
        after: { stickerNumber: stickerNumber.trim(), stickerIssuedAt: now },
      },
    });

    return this.get(id);
  }

  /** Update vehicle status (Active, Blocked, Expired). */
  static async updateStatus(id, status, req) {
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) throw new ApiError(404, "Vehicle not found");

    await Vehicle.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog({
      req,
      entityType: "Vehicle",
      entityId: id,
      action: AuditLog.ACTIONS.UPDATE,
      changes: {
        before: { status: vehicle.status },
        after: { status },
      },
    });

    return this.get(id);
  }
}

module.exports = { VehicleService };
