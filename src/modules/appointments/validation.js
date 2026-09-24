const { z } = require("zod");
const Appointment = require("./appointment.model");

const createAppointmentSchema = z.object({
  visitorName: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(2).max(500),
  hostEmployee: z.string().min(1),
  checkInTime: z.string().datetime({ offset: true }).optional().nullable(),
});

const listAppointmentsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(Object.values(Appointment.STATUS)).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

module.exports = { createAppointmentSchema, listAppointmentsSchema };
