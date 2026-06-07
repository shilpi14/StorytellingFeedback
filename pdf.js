const PDFDocument = require("pdfkit");

const BRAND = "#5b4bb8";
const HEADING = "#1f3a5f";
const ACCENT = "#5b4bb8";
const BODY = "#3f3f46";
const MUTED = "#8a8a92";

function toTen(scoreOutOf100) {
  return (scoreOutOf100 / 10).toFixed(1);
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function heading(doc, text, size = 14) {
  doc.fontSize(size).fillColor(HEADING).font("Helvetica-Bold").text(text, { lineGap: 4 });
}

function body(doc, text) {
  doc.fontSize(11).fillColor(BODY).font("Helvetica").text(text, { lineGap: 3 });
}

function suggestion(doc, text) {
  doc.fontSize(10.5).fillColor(ACCENT).font("Helvetica-Bold").text("›  ", { continued: true, lineGap: 3 });
  doc.fillColor(BODY).font("Helvetica").text(text, { lineGap: 3 });
}

function buildFeedbackPdf(feedback, res) {
  const doc = new PDFDocument({ margin: 56 });
  doc.pipe(res);

  // --- Brand header ---
  doc.fontSize(20).fillColor(BRAND).font("Helvetica-Bold")
    .text("Elevate Your Story", { align: "center", lineGap: 2 });
  doc.fontSize(12).fillColor(MUTED).font("Helvetica")
    .text("StoryWallahs", { align: "center", lineGap: 2 });
  doc.moveDown(0.5);
  doc.fontSize(16).fillColor(HEADING).font("Helvetica-Bold")
    .text("Story Assessment Report", { align: "center", lineGap: 4 });
  doc.moveDown(0.5);

  const metaLines = [`File: ${feedback.fileName}`];
  if (feedback.speakerName) metaLines.push(`Speaker: ${feedback.speakerName}`);
  if (feedback.context) metaLines.push(`Context: ${feedback.context}`);
  metaLines.push(`Generated: ${new Date(feedback.generatedAt).toLocaleString()}`);

  doc.fontSize(10).fillColor(MUTED).font("Helvetica");
  metaLines.forEach((line) => doc.text(line, { align: "center", lineGap: 2 }));
  doc.moveDown(1.6);

  heading(doc, `Overall Score: ${toTen(feedback.overallScore)} / 10`, 17);
  doc.moveDown(1.2);

  feedback.sections.forEach((section, index) => {
    heading(doc, `${section.title} — ${toTen(section.score)}`, 13);
    doc.moveDown(0.2);
    body(doc, section.summary);

    if (section.coachingSuggestions && section.coachingSuggestions.length) {
      doc.moveDown(0.5);
      doc.fontSize(10.5).fillColor(HEADING).font("Helvetica-Bold")
        .text("Coaching Suggestions", { lineGap: 2 });
      doc.moveDown(0.2);
      section.coachingSuggestions.forEach((tip) => suggestion(doc, tip));
    }

    if (index < feedback.sections.length - 1) doc.moveDown(1.1);
  });

  // --- Real snapshots from the speaker's own video ---
  if (feedback.frames && feedback.frames.length) {
    doc.moveDown(1.4);
    heading(doc, "Moments from the Video", 13);
    doc.moveDown(0.6);

    const displayWidth = 260;
    const pageLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const centerX = pageLeft + (contentWidth - displayWidth) / 2;
    const captionGap = 4;
    const captionHeight = 14;
    const blockGap = 14;

    feedback.frames.forEach((frame) => {
      let displayHeight = displayWidth * 0.6;
      try {
        const img = doc.openImage(frame.image);
        displayHeight = (displayWidth / img.width) * img.height;
      } catch {
        return;
      }

      const blockHeight = displayHeight + captionGap + captionHeight;
      if (doc.y + blockHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      try {
        doc.image(frame.image, centerX, doc.y, { width: displayWidth, height: displayHeight });
      } catch {
        return;
      }

      const captionY = doc.y + displayHeight + captionGap;
      doc.fontSize(9).fillColor(MUTED).font("Helvetica")
        .text(formatTimestamp(frame.timestamp), pageLeft, captionY, { width: contentWidth, align: "center" });

      doc.y = captionY + captionHeight + blockGap;
    });
  }

  doc.end();
}

module.exports = { buildFeedbackPdf };
