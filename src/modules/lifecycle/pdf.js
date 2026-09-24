const PDFDocument = require("pdfkit");

function createLifecyclePdf({ title, reference, lines = [], footer = "" }) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.fontSize(20).text(title, { align: "center" });
    document.moveDown(0.5);
    if (reference) document.fontSize(10).fillColor("#555").text(`Reference: ${reference}`, { align: "center" });
    document.moveDown(1.5).fillColor("#111");
    lines.forEach((line) => {
      if (typeof line === "string") document.fontSize(11).text(line);
      else document.fontSize(11).text(`${line.label || ""}: ${line.value ?? ""}`);
      document.moveDown(0.35);
    });
    if (footer) document.moveDown(1).fontSize(9).fillColor("#555").text(footer);
    document.end();
  });
}

module.exports = { createLifecyclePdf };
