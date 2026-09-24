const { db } = require("../../config/db");
const { Plot } = require("../properties/plot.model");
const { OPEN_STATUSES } = require("../complaints/complaint.config");

const catalog = [
  { key: "property-inventory", module: "Property", label: "Property Inventory", description: "Plot inventory by status, block and category." },
  { key: "ownership-transfers", module: "Property", label: "Ownership & Transfers", description: "Ownership history and transfer workflow outcomes." },
  { key: "occupancy", module: "Property", label: "Occupancy", description: "Occupied, available and reserved plot distribution." },
  { key: "operations-sla", module: "Operations", label: "Operations SLA", description: "Complaint SLA compliance and resolution performance." },
  { key: "staff-performance", module: "HR", label: "Staff Performance", description: "Attendance, leave and work-order workload by employee." },
  { key: "hr-attendance", module: "HR", label: "HR Attendance", description: "Attendance status and working-day distribution." },
  { key: "hr-leave", module: "HR", label: "HR Leave", description: "Leave requests, decisions and balances." },
  { key: "procurement", module: "Procurement", label: "Procurement Summary", description: "Purchase orders, vendors and procurement value." },
  { key: "inventory", module: "Inventory", label: "Inventory & Low Stock", description: "Current stock, reorder levels and shortages." },
];

const rangeFor = (filters = {}) => {
  const current = new Date();
  const start = filters.startDate ? new Date(filters.startDate) : new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const end = filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : current;
  return { start, end };
};
const inRange = (value, range) => {
  if (!value) return false;
  const date = new Date(value);
  return date >= range.start && date <= range.end;
};
const countBy = (records, field) => {
  const map = new Map();
  records.forEach((record) => map.set(record[field] || "Unspecified", (map.get(record[field] || "Unspecified") || 0) + 1));
  return Array.from(map, ([label, count]) => ({ label, count }));
};
const money = (records, field = "amount") => records.reduce((total, record) => total + Number(record[field] || 0), 0);

async function propertyInventory() {
  const [plots, blocks, categories] = await Promise.all([db.collection("plots").find({}), db.collection("blocks").find({}), db.collection("plotCategories").find({})]);
  const blockName = new Map(blocks.map((item) => [item._id, item.name]));
  const categoryName = new Map(categories.map((item) => [item._id, item.name]));
  return {
    report: "property-inventory",
    data: plots.map((plot) => ({ plotNumber: plot.plotNumber, status: plot.status, block: blockName.get(plot.block) || "Unassigned", category: categoryName.get(plot.category) || "Unassigned", size: plot.size, price: plot.price, currentOwner: plot.currentOwner || null })),
    total: plots.length,
  };
}

async function ownershipTransfers(filters) {
  const range = rangeFor(filters);
  const [transfers, members, plots] = await Promise.all([db.collection("transferRequests").find({}), db.collection("members").find({}), db.collection("plots").find({})]);
  const memberName = new Map(members.map((member) => [member._id, member.name]));
  const plotNumber = new Map(plots.map((plot) => [plot._id, plot.plotNumber]));
  const data = transfers.filter((item) => inRange(item.createdAt, range)).map((item) => ({ transferId: item._id, plot: plotNumber.get(item.plot) || item.plot, fromMember: memberName.get(item.fromMember) || item.fromMember, toMember: memberName.get(item.toMember) || item.toMember, type: item.type, status: item.status, createdAt: item.createdAt, completedAt: item.completedAt || null }));
  return { report: "ownership-transfers", range, data, total: data.length, summary: { completed: data.filter((item) => item.status === "Completed").length, pending: data.filter((item) => !["Completed", "Rejected"].includes(item.status)).length, rejected: data.filter((item) => item.status === "Rejected").length } };
}

async function occupancy() {
  const [plots, blocks] = await Promise.all([db.collection("plots").find({}), db.collection("blocks").find({})]);
  const blockName = new Map(blocks.map((item) => [item._id, item.name]));
  const grouped = new Map();
  plots.forEach((plot) => { const key = blockName.get(plot.block) || "Unassigned"; const item = grouped.get(key) || { block: key, total: 0, occupied: 0, available: 0, reserved: 0 }; item.total += 1; if (plot.currentOwner) item.occupied += 1; if (plot.status === Plot.STATUS.AVAILABLE) item.available += 1; if (plot.status === Plot.STATUS.RESERVED) item.reserved += 1; grouped.set(key, item); });
  const data = Array.from(grouped.values()).map((item) => ({ ...item, occupancyRate: item.total ? Number(((item.occupied / item.total) * 100).toFixed(1)) : 0 }));
  return { report: "occupancy", data, total: data.length, summary: { totalPlots: plots.length, occupied: plots.filter((item) => item.currentOwner).length, available: plots.filter((item) => item.status === Plot.STATUS.AVAILABLE).length } };
}

async function operationsSla(filters) {
  const range = rangeFor(filters);
  const complaints = (await db.collection("complaints").find({})).filter((item) => inRange(item.createdAt, range));
  const now = new Date();
  const data = complaints.map((item) => ({ complaintNumber: item.complaintNumber, category: item.category, priority: item.priority, status: item.status, createdAt: item.createdAt, slaDueDate: item.slaDueDate, resolvedAt: item.resolvedAt || null, slaStatus: OPEN_STATUSES.includes(item.status) && new Date(item.slaDueDate) < now ? "Breached" : item.status === "Resolved" || item.status === "Closed" ? "Met" : "Within SLA", resolutionHours: item.resolvedAt ? Number(((new Date(item.resolvedAt) - new Date(item.createdAt)) / 3600000).toFixed(1)) : null }));
  return { report: "operations-sla", range, data, total: data.length, summary: { total: data.length, breached: data.filter((item) => item.slaStatus === "Breached").length, met: data.filter((item) => item.slaStatus === "Met").length, byStatus: countBy(data, "status") } };
}

async function staffPerformance(filters) {
  const range = rangeFor(filters);
  const [employees, attendance, leaves, workOrders] = await Promise.all([db.collection("employees").find({}), db.collection("attendance").find({}), db.collection("leaveRequests").find({}), db.collection("workOrders").find({})]);
  const data = employees.map((employee) => { const employeeAttendance = attendance.filter((item) => item.employee === employee._id && inRange(item.date, range)); const employeeLeaves = leaves.filter((item) => item.employee === employee._id && inRange(item.createdAt, range)); const assignedOrders = workOrders.filter((item) => item.assignedStaff === employee._id); return { employeeId: employee.employeeId, name: employee.name, department: employee.department, designation: employee.designation, present: employeeAttendance.filter((item) => item.status === "Present").length, absent: employeeAttendance.filter((item) => item.status === "Absent").length, leaveRequests: employeeLeaves.length, assignedWorkOrders: assignedOrders.length, openWorkOrders: assignedOrders.filter((item) => ["Open", "InProgress"].includes(item.status)).length }; });
  return { report: "staff-performance", range, data, total: data.length };
}

async function hrAttendance(filters) {
  const range = rangeFor(filters);
  const [attendance, employees] = await Promise.all([db.collection("attendance").find({}), db.collection("employees").find({})]);
  const employeeMap = new Map(employees.map((employee) => [employee._id, employee]));
  const data = attendance.filter((item) => inRange(item.date, range)).map((item) => ({ date: item.date, employeeId: employeeMap.get(item.employee)?.employeeId || item.employee, employeeName: employeeMap.get(item.employee)?.name || "Unknown", department: employeeMap.get(item.employee)?.department || "—", status: item.status, checkIn: item.checkIn, checkOut: item.checkOut }));
  return { report: "hr-attendance", range, data, total: data.length, summary: { byStatus: countBy(data, "status"), byDepartment: countBy(data, "department") } };
}

async function hrLeave(filters) {
  const range = rangeFor(filters);
  const [leaves, employees] = await Promise.all([db.collection("leaveRequests").find({}), db.collection("employees").find({})]);
  const employeeMap = new Map(employees.map((employee) => [employee._id, employee]));
  const data = leaves.filter((item) => inRange(item.createdAt, range)).map((item) => ({ requestId: item._id, employeeId: employeeMap.get(item.employee)?.employeeId || item.employee, employeeName: employeeMap.get(item.employee)?.name || "Unknown", type: item.type, fromDate: item.fromDate, toDate: item.toDate, status: item.status, available: item.balanceSnapshot?.available ?? null }));
  return { report: "hr-leave", range, data, total: data.length, summary: { byStatus: countBy(data, "status"), byType: countBy(data, "type") } };
}

async function procurement(filters) {
  const range = rangeFor(filters);
  const [orders, vendors] = await Promise.all([db.collection("purchaseOrders").find({}), db.collection("vendors").find({})]);
  const vendorMap = new Map(vendors.map((vendor) => [vendor._id, vendor.name]));
  const data = orders.filter((item) => inRange(item.createdAt, range)).map((item) => ({ poNumber: item.poNumber, vendor: vendorMap.get(item.selectedVendor) || item.selectedVendor, status: item.status, totalAmount: item.totalAmount, deliveryDate: item.deliveryDate, createdAt: item.createdAt }));
  return { report: "procurement", range, data, total: data.length, summary: { committed: money(data, "totalAmount"), byStatus: countBy(data, "status"), vendors: new Set(data.map((item) => item.vendor)).size } };
}

async function inventory() {
  const items = await db.collection("inventoryItems").find({});
  const data = items.map((item) => ({ sku: item.sku, name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, reorderLevel: item.reorderLevel, lowStock: Number(item.quantity || 0) <= Number(item.reorderLevel || 0), shortage: Math.max(0, Number(item.reorderLevel || 0) - Number(item.quantity || 0)) }));
  return { report: "inventory", data, total: data.length, summary: { lowStock: data.filter((item) => item.lowStock).length, totalItems: data.length } };
}

const runners = { "property-inventory": propertyInventory, "ownership-transfers": ownershipTransfers, occupancy, "operations-sla": operationsSla, "staff-performance": staffPerformance, "hr-attendance": hrAttendance, "hr-leave": hrLeave, procurement, inventory };

async function run(type, filters) {
  const runner = runners[type];
  if (!runner) return null;
  return runner(filters);
}

module.exports = { catalog, run };
