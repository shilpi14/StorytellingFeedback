const PDFDocument = require("pdfkit");

const HEADING = "#1f3a5f";
const BODY = "#3f3f46";
const MUTED = "#8a8a92";

function toTen(scoreOutOf100) {
  return (scoreOutOf100 / 10).toFixed(1);
}

function heading(doc, text, size = 14) {
  doc.fontSize(size).fillColor(HEADING).font("Helvetica-Bold").text(text, { lineGap: 4 });
}

function body(doc, text) {
  doc.fontSize(11).fillColor(BODY).font("Helvetica").text(text, { lineGap: 3 });
}

// Renders a summary that may contain multiple short paragraphs separated by blank lines.
function summary(doc, text) {
  const paragraphs = String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph, index) => {
    body(doc, paragraph);
    if (index < paragraphs.length - 1) doc.moveDown(0.5);
  });
}

function buildFeedbackPdf(feedback, res) {
  const doc = new PDFDocument({ margin: 56 });
  doc.pipe(res);

  doc.fontSize(22).fillColor(HEADING).font("Helvetica-Bold")
    .text("Video Feedback Report", { align: "center", lineGap: 6 });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor(MUTED).font("Helvetica")
    .text(`File: ${feedback.fileName}`, { align: "center", lineGap: 2 })
    .text(`Generated: ${new Date(feedback.generatedAt).toLocaleString()}`, { align: "center" });
  doc.moveDown(1.6);

  heading(doc, `Overall Score: ${toTen(feedback.overallScore)} / 10`, 17);
  doc.moveDown(1.2);

  feedback.sections.forEach((section, index) => {
    heading(doc, `${section.title} — ${toTen(section.score)}`, 13);
    doc.moveDown(0.2);
    summary(doc, section.summary);
    if (index < feedback.sections.length - 1) doc.moveDown(0.9);
  });

  doc.moveDown(1.4);
  heading(doc, "Strengths");
  doc.moveDown(0.3);
  feedback.strengths.forEach((item) => body(doc, `•  ${item}`));

  doc.moveDown(1.2);
  heading(doc, "Suggested Improvements");
  doc.moveDown(0.3);
  feedback.improvements.forEach((item) => body(doc, `•  ${item}`));

  doc.end();
}

module.exports = { buildFeedbackPdf };
