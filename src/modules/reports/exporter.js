const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const rowsForReport = (report) => report.data || [];

const createWorkbook = async (report) => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet(report.report);
  const rows = rowsForReport(report); const headers = rows.length ? Object.keys(rows[0]) : ["message"];
  sheet.addRow(headers); rows.forEach((row) => sheet.addRow(headers.map((header) => typeof row[header] === "object" ? JSON.stringify(row[header]) : row[header]))); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach((column) => { column.width = Math.min(40, Math.max(12, (column.header || "").length + 4)); });
  return workbook.xlsx.writeBuffer();
};

const createPdf = (report) => new Promise((resolve) => { const chunks = []; const pdf = new PDFDocument({ margin: 40 }); pdf.on("data", (chunk) => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.fontSize(18).text(`Finance Report: ${report.report}`).moveDown().fontSize(9).text(`Range: ${report.range.start} to ${report.range.end}`).moveDown(); rowsForReport(report).forEach((row) => pdf.text(Object.entries(row).map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join(" | "))); pdf.end(); });

module.exports = { createWorkbook, createPdf };