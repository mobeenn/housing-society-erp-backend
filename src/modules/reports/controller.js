const RbacService = require("../rbac/service");
const { ReportService } = require("./service");
const { createWorkbook, createPdf } = require("./exporter");
const ApiError = require("../../utils/ApiError");
const ApiResponse = require("../../utils/apiResponse");

exports.getCatalog = async (_req, res) => {
  const catalog = await ReportService.catalog();
  return ApiResponse.success(res, 200, "Report catalog retrieved", catalog);
};

exports.getDashboard = async (_req, res) => {
  const dashboard = await ReportService.dashboard();
  return ApiResponse.success(res, 200, "Dashboard data retrieved", dashboard);
};

const MAX_REPORT_ROWS = 5000;
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

function assertReportSize(report) {
  const rows = Array.isArray(report?.rows)
    ? report.rows
    : Array.isArray(report?.data)
      ? report.data
      : Array.isArray(report)
        ? report
        : null;
  if (rows && rows.length > MAX_REPORT_ROWS) {
    throw new ApiError(
      413,
      "Report too large; narrow filters (date range, status, or block) and try again."
    );
  }
}

exports.getReport = async (req, res) => {
  const report = await ReportService.run(req.params.type, req.query);
  assertReportSize(report);
  if (!req.query.format || req.query.format === "json")
    return ApiResponse.success(res, 200, report);
  if (!(await RbacService.isAllowed(req.user, "reports", "export")))
    throw new ApiError(
      403,
      "Access denied. Missing permissions: reports:export",
    );
  if (req.query.format === "xlsx") {
    const buffer = await createWorkbook(report);
    if (buffer.length > MAX_EXPORT_BYTES) {
      throw new ApiError(
        413,
        "Report too large; narrow filters (date range, status, or block) and try again."
      );
    }
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="${report.report}.xlsx"`,
      )
      .send(buffer);
    return;
  }
  if (req.query.format === "pdf") {
    const buffer = await createPdf(report);
    if (buffer.length > MAX_EXPORT_BYTES) {
      throw new ApiError(
        413,
        "Report too large; narrow filters (date range, status, or block) and try again."
      );
    }
    res
      .type("application/pdf")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="${report.report}.pdf"`,
      )
      .send(buffer);
    return;
  }
  throw new ApiError(400, "format must be json, pdf, or xlsx");
};
