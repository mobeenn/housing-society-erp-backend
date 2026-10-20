const ApiError = require("../../utils/ApiError");
const MemberService = require("../members/service");
const Member = require("../members/member.model");
const PlotService = require("../properties/service");
const { Plot } = require("../properties/plot.model");
const { Block, Street, PlotCategory, PropertyType } = require("./masterData.model");
const { createAuditLog, AuditLog } = require("./auditLog.model");
const { createMemberSchema } = require("../members/validation");
const { createPlotSchema } = require("../properties/validation");

const MEMBER_HEADERS = ["name", "cnic", "phone", "email", "address", "status"];
const PLOT_HEADERS = [
  "block",
  "street",
  "size",
  "category",
  "propertyType",
  "price",
  "fileNumber",
  "location",
  "status",
];

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length);
  if (!lines.length) return { headers: [], rows: [] };

  const split = (line) => {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = split(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map((line, index) => {
    const cells = split(line);
    const obj = { __row: index + 2 };
    headers.forEach((header, i) => {
      obj[header] = cells[i] != null ? String(cells[i]).replace(/^"|"$/g, "").trim() : "";
    });
    return obj;
  });
  return { headers, rows };
}

function toCsv(rows, headers) {
  const escape = (value) => {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

function emptyToNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

async function resolveMaster(model, value, label) {
  if (!value) return { error: `${label} is required` };
  const byId = await model.findById(value);
  if (byId) return { id: byId._id };
  const all = await model.find({}, { limit: 500 });
  const needle = String(value).trim().toLowerCase();
  const hit = (all || []).find(
    (item) =>
      String(item.name || "").toLowerCase() === needle ||
      String(item.code || "").toLowerCase() === needle
  );
  if (hit) return { id: hit._id };
  return { error: `${label} "${value}" not found (use name, code, or id)` };
}

class CsvImportService {
  static memberTemplate() {
    return toCsv(
      [
        {
          name: "Ali Khan",
          cnic: "35202-1234567-1",
          phone: "03001234567",
          email: "ali@example.com",
          address: "Lahore",
          status: "Active",
        },
      ],
      MEMBER_HEADERS
    );
  }

  static plotTemplate() {
    return toCsv(
      [
        {
          block: "A",
          street: "1",
          size: "5 Marla",
          category: "Residential",
          propertyType: "Plot",
          price: "2500000",
          fileNumber: "",
          location: "",
          status: "Available",
        },
      ],
      PLOT_HEADERS
    );
  }

  static async previewMembers(csvText) {
    const { rows } = parseCsv(csvText);
    const existing = await Member.find({}, { limit: 10000 });
    const cnicSet = new Set((existing || []).map((m) => String(m.cnic || "").trim()));
    const seen = new Set();
    const valid = [];
    const errors = [];
    const duplicates = [];

    for (const row of rows) {
      const payload = {
        name: row.name,
        cnic: row.cnic,
        phone: emptyToNull(row.phone),
        email: emptyToNull(row.email),
        address: emptyToNull(row.address),
        status: emptyToNull(row.status) || "Active",
      };
      const parsed = createMemberSchema.safeParse(payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ row: row.__row, field: issue.path.join(".") || "row", message: issue.message });
        }
        continue;
      }
      if (cnicSet.has(parsed.data.cnic) || seen.has(parsed.data.cnic)) {
        duplicates.push({ row: row.__row, field: "cnic", message: `Duplicate CNIC ${parsed.data.cnic}` });
        errors.push({ row: row.__row, field: "cnic", message: `Duplicate CNIC ${parsed.data.cnic}` });
        continue;
      }
      seen.add(parsed.data.cnic);
      valid.push({ row: row.__row, data: parsed.data });
    }

    return {
      total: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      valid,
      errors,
      duplicates,
    };
  }

  static async previewPlots(csvText) {
    const { rows } = parseCsv(csvText);
    const existing = await Plot.find({}, { limit: 10000 });
    const fileSet = new Set(
      (existing || []).map((p) => String(p.fileNumber || "").trim().toLowerCase()).filter(Boolean)
    );
    const seenFiles = new Set();
    const valid = [];
    const errors = [];
    const duplicates = [];

    for (const row of rows) {
      const block = await resolveMaster(Block, row.block, "block");
      const street = await resolveMaster(Street, row.street, "street");
      const category = await resolveMaster(PlotCategory, row.category, "category");
      const propertyType = await resolveMaster(PropertyType, row.propertyType, "propertyType");
      const refErrors = [block, street, category, propertyType].filter((r) => r.error);
      if (refErrors.length) {
        for (const err of refErrors) {
          errors.push({ row: row.__row, field: "reference", message: err.error });
        }
        continue;
      }

      const payload = {
        block: block.id,
        street: street.id,
        size: row.size,
        category: category.id,
        propertyType: propertyType.id,
        price: row.price,
        fileNumber: emptyToNull(row.fileNumber),
        location: emptyToNull(row.location),
        status: emptyToNull(row.status) || undefined,
      };
      const parsed = createPlotSchema.safeParse(payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ row: row.__row, field: issue.path.join(".") || "row", message: issue.message });
        }
        continue;
      }
      const fileKey = parsed.data.fileNumber ? String(parsed.data.fileNumber).toLowerCase() : null;
      if (fileKey && (fileSet.has(fileKey) || seenFiles.has(fileKey))) {
        duplicates.push({ row: row.__row, field: "fileNumber", message: `Duplicate fileNumber ${parsed.data.fileNumber}` });
        errors.push({ row: row.__row, field: "fileNumber", message: `Duplicate fileNumber ${parsed.data.fileNumber}` });
        continue;
      }
      if (fileKey) seenFiles.add(fileKey);
      valid.push({ row: row.__row, data: parsed.data });
    }

    return {
      total: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      valid,
      errors,
      duplicates,
    };
  }

  static async commitMembers({ mode, rows }, req) {
    if (!["all_or_nothing", "valid_only"].includes(mode)) {
      throw new ApiError(400, "mode must be all_or_nothing or valid_only");
    }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) throw new ApiError(400, "No rows to import");

    const revalidated = [];
    const errors = [];
    for (const item of list) {
      const parsed = createMemberSchema.safeParse(item.data || item);
      if (!parsed.success) {
        errors.push({
          row: item.row,
          message: parsed.error.issues.map((i) => i.message).join("; "),
        });
      } else {
        revalidated.push({ row: item.row, data: parsed.data });
      }
    }

    if (mode === "all_or_nothing" && errors.length) {
      throw new ApiError(400, "Import blocked: fix errors or use valid_only", errors);
    }
    if (!revalidated.length) throw new ApiError(400, "No valid rows to import");

    const created = [];
    try {
      for (const item of revalidated) {
        const result = await MemberService.createMember(item.data, req.user._id || req.user.id);
        created.push(result.member);
      }
    } catch (error) {
      if (mode === "all_or_nothing") {
        for (const member of created) {
          try {
            await Member.delete(member._id);
          } catch {
            /* best-effort rollback */
          }
        }
      }
      throw error;
    }

    await createAuditLog({
      req,
      entityType: "CsvImport",
      entityId: "members",
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: { type: "members", mode, count: created.length } },
    });

    return { imported: created.length, ids: created.map((m) => m._id) };
  }

  static async commitPlots({ mode, rows }, req) {
    if (!["all_or_nothing", "valid_only"].includes(mode)) {
      throw new ApiError(400, "mode must be all_or_nothing or valid_only");
    }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) throw new ApiError(400, "No rows to import");

    const revalidated = [];
    const errors = [];
    for (const item of list) {
      const parsed = createPlotSchema.safeParse(item.data || item);
      if (!parsed.success) {
        errors.push({
          row: item.row,
          message: parsed.error.issues.map((i) => i.message).join("; "),
        });
      } else {
        revalidated.push({ row: item.row, data: parsed.data });
      }
    }

    if (mode === "all_or_nothing" && errors.length) {
      throw new ApiError(400, "Import blocked: fix errors or use valid_only", errors);
    }
    if (!revalidated.length) throw new ApiError(400, "No valid rows to import");

    const created = [];
    try {
      for (const item of revalidated) {
        const plot = await PlotService.create(item.data, req);
        created.push(plot);
      }
    } catch (error) {
      if (mode === "all_or_nothing") {
        for (const plot of created) {
          try {
            await Plot.delete(plot._id);
          } catch {
            /* best-effort rollback */
          }
        }
      }
      throw error;
    }

    await createAuditLog({
      req,
      entityType: "CsvImport",
      entityId: "plots",
      action: AuditLog.ACTIONS.CREATE,
      changes: { after: { type: "plots", mode, count: created.length } },
    });

    return { imported: created.length, ids: created.map((p) => p._id) };
  }

  static errorsToCsv(errors) {
    return toCsv(
      (errors || []).map((e) => ({
        row: e.row,
        field: e.field || "",
        message: e.message,
      })),
      ["row", "field", "message"]
    );
  }
}

module.exports = CsvImportService;
