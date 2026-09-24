const { z } = require("zod");
const { VEHICLE_TYPES, VEHICLE_STATUSES } = require("./vehicles.config");

const createVehicleSchema = z.object({
  owner: z.string().optional().nullable(), // ref Member
  number: z.string().min(1, "Vehicle number is required"),
  type: z.enum(VEHICLE_TYPES),
  model: z.string().optional().nullable(),
  stickerNumber: z.string().optional().nullable(),
  status: z.enum(VEHICLE_STATUSES).optional(),
});

const updateVehicleSchema = z.object({
  owner: z.string().optional().nullable(),
  number: z.string().min(1).optional(),
  type: z.enum(VEHICLE_TYPES).optional(),
  model: z.string().optional().nullable(),
  stickerNumber: z.string().optional().nullable(),
  status: z.enum(VEHICLE_STATUSES).optional(),
});

const issueStickerSchema = z.object({
  stickerNumber: z.string().min(1, "Sticker number is required"),
});

const updateStatusSchema = z.object({
  status: z.enum(VEHICLE_STATUSES),
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  issueStickerSchema,
  updateStatusSchema,
  VEHICLE_TYPES,
  VEHICLE_STATUSES,
};
