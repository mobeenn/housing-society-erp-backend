const { z } = require("zod");
const { ASSET_TYPES, PRIORITIES, STATUS_LIST } = require("./maintenance.config");

const createAssetSchema = z.object({
  name: z.string().min(2),
  type: z.enum(ASSET_TYPES),
  location: z.string().optional().nullable(),
  block: z.string().optional().nullable(), // master data Block ref (nullable)
});

const updateAssetSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(ASSET_TYPES).optional(),
  location: z.string().optional().nullable(),
  block: z.string().optional().nullable(),
});

const materialSchema = z.object({
  item: z.string().min(1),
  quantity: z.union([z.string(), z.number()]),
});

const createWorkOrderSchema = z.object({
  asset: z.string().optional().nullable(),
  relatedComplaint: z.string().optional().nullable(),
  description: z.string().min(3),
  assignedStaff: z.string().optional().nullable(), // ref User
  contractor: z.string().optional().nullable(), // external contractor name
  priority: z.enum(PRIORITIES),
  expectedCompletion: z.string().optional().nullable(),
  materials: z.array(materialSchema).optional().default([]),
  laborCost: z.coerce.number().min(0).optional().default(0),
  materialCost: z.coerce.number().min(0).optional().default(0),
});

const updateWorkOrderSchema = z.object({
  description: z.string().min(3).optional(),
  assignedStaff: z.string().optional().nullable(),
  contractor: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).optional(),
  expectedCompletion: z.string().optional().nullable(),
  materials: z.array(materialSchema).optional(),
  laborCost: z.coerce.number().min(0).optional(),
  materialCost: z.coerce.number().min(0).optional(),
});

const progressSchema = z.object({
  note: z.string().min(2),
});

const statusSchema = z.object({
  status: z.enum(STATUS_LIST),
});

const completeSchema = z.object({
  completionNote: z.string().min(3),
});

const cancelSchema = z.object({
  reason: z.string().optional().nullable(),
});

module.exports = {
  createAssetSchema,
  updateAssetSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  progressSchema,
  statusSchema,
  completeSchema,
  cancelSchema,
  ASSET_TYPES,
  WORK_ORDER_STATUSES: STATUS_LIST,
};