const { z } = require("zod");
const { Plot } = require("./plot.model");

const plotFields = {
  block: z.string().min(1, "Block is required"),
  street: z.string().min(1, "Street is required"),
  size: z.string().min(1, "Size is required"),
  category: z.string().min(1, "Plot category is required"),
  propertyType: z.string().min(1, "Property type is required"),
  fileNumber: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  currentOwner: z.string().optional().nullable(),
  status: z.enum(Object.values(Plot.STATUS)).optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
};

const createPlotSchema = z.object(plotFields);
const updatePlotSchema = z.object(plotFields).partial();
const updateStatusSchema = z.object({ status: z.enum(Object.values(Plot.STATUS)), remarks: z.string().optional() });

module.exports = { createPlotSchema, updatePlotSchema, updateStatusSchema };