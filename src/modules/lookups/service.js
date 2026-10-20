const { prisma } = require("../../config/prisma");
const ApiError = require("../../utils/ApiError");
const RbacService = require("../rbac/service");
const { LOOKUP_PICKER_MODULES } = require("../../seeds/roleMatrix");

function maskCnic(cnic) {
  const raw = String(cnic || "").replace(/\D/g, "");
  if (raw.length < 5) return raw ? "*****" : "";
  return `${raw.slice(0, 5)}-*******-${raw.slice(-1)}`;
}

async function canUseMemberLookup(user) {
  if (RbacService.isSuperAdmin(user)) return true;
  if (await RbacService.isAllowed(user, "members", "view")) return true;
  for (const moduleKey of LOOKUP_PICKER_MODULES) {
    if (await RbacService.isAllowed(user, moduleKey, "create")) return true;
  }
  return false;
}

async function canUsePlotLookup(user) {
  if (RbacService.isSuperAdmin(user)) return true;
  if (await RbacService.isAllowed(user, "plots", "view")) return true;
  for (const moduleKey of LOOKUP_PICKER_MODULES) {
    if (await RbacService.isAllowed(user, moduleKey, "create")) return true;
  }
  return false;
}

class LookupService {
  static async searchMembers(user, { q = "", limit = 20 } = {}) {
    if (!(await canUseMemberLookup(user))) {
      throw new ApiError(403, "You do not have permission to look up members");
    }
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const term = String(q || "").trim();
    const where = term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { memberId: { contains: term, mode: "insensitive" } },
            { cnic: { contains: term, mode: "insensitive" } },
            { phone: { contains: term, mode: "insensitive" } },
          ],
        }
      : {};

    const rows = await prisma.member.findMany({
      where,
      take,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        memberId: true,
        cnic: true,
        phone: true,
        status: true,
      },
    });

    return rows.map((m) => ({
      id: m.id,
      label: m.name,
      secondary: [m.memberId, maskCnic(m.cnic)].filter(Boolean).join(" · "),
      memberId: m.memberId,
      status: m.status,
    }));
  }

  static async searchPlots(user, { q = "", limit = 20 } = {}) {
    if (!(await canUsePlotLookup(user))) {
      throw new ApiError(403, "You do not have permission to look up plots");
    }
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const term = String(q || "").trim();
    const where = term
      ? {
          OR: [
            { plotNumber: { contains: term, mode: "insensitive" } },
            { block: { contains: term, mode: "insensitive" } },
            { street: { contains: term, mode: "insensitive" } },
          ],
        }
      : {};

    const rows = await prisma.plot.findMany({
      where,
      take,
      orderBy: { plotNumber: "asc" },
      select: {
        id: true,
        plotNumber: true,
        block: true,
        street: true,
        status: true,
      },
    });

    return rows.map((p) => ({
      id: p.id,
      label: p.plotNumber || p.id,
      secondary: [p.block, p.street, p.status].filter(Boolean).join(" · "),
      plotNumber: p.plotNumber,
      status: p.status,
    }));
  }
}

LookupService.canUseMemberLookup = canUseMemberLookup;
LookupService.canUsePlotLookup = canUsePlotLookup;
LookupService.maskCnic = maskCnic;

module.exports = LookupService;
