const path = require("path");
const fs = require("fs");

const LOGO_PNG = path.join(__dirname, "../../assets/brand/civica-logo.png");

/**
 * Draw Civica wordmark at the top of a PDFKit document (white-surface docs).
 * Falls back to text if the asset is missing.
 */
function drawCivicaLogo(pdf, { x = 50, y = 40, width = 120 } = {}) {
  if (fs.existsSync(LOGO_PNG)) {
    pdf.image(LOGO_PNG, x, y, { width, height: width * (64 / 220) });
    pdf.y = y + width * (64 / 220) + 16;
    return;
  }
  pdf.fontSize(18).fillColor("#0F172A").text("Civica", x, y);
  pdf.y = y + 28;
}

module.exports = { drawCivicaLogo, LOGO_PNG };
