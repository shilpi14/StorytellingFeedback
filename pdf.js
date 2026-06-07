const PDFDocument = require("pdfkit");

// StoryWallahs brand palette — matches the sample "Elevate Your Story" report
const NAVY = "#1c2541";
const GOLD = "#c8a04b";
const GRAY = "#9a9a9a";
const HEADING = "#1f3a5f";
const BODY = "#3f3f46";
const MUTED = "#74747e";
const RING_TRACK = "#e2e2e9";
const BORDER = "#dcdce4";

function toTen(scoreOutOf100) {
  return Math.round(scoreOutOf100) / 10;
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function scoreColor(scoreOutOfTen) {
  if (scoreOutOfTen >= 8) return "#3f7d4a";
  if (scoreOutOfTen >= 6) return "#5c7a4a";
  if (scoreOutOfTen >= 4) return "#b8862f";
  return "#ad4f3f";
}

// Draws a circular progress ring (track + colored arc) with the score centered inside.
function scoreRing(doc, cx, cy, radius, scoreOutOfTen) {
  const percent = Math.min(Math.max(scoreOutOfTen, 0), 10) / 10;
  const lineWidth = Math.max(4, radius * 0.18);
  const color = scoreColor(scoreOutOfTen);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + percent * Math.PI * 2;

  doc.save();
  doc.lineWidth(lineWidth).strokeColor(RING_TRACK).lineCap("butt");
  doc.circle(cx, cy, radius).stroke();
  doc.restore();

  if (percent > 0) {
    doc.save();
    doc.lineWidth(lineWidth).strokeColor(color).lineCap("round");
    const steps = Math.max(2, Math.round(90 * percent));
    doc.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle));
    for (let i = 1; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      doc.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    doc.stroke();
    doc.restore();
  }

  const fontSize = radius >= 28 ? 19 : 13;
  doc.fontSize(fontSize).font("Helvetica-Bold").fillColor(HEADING)
    .text(String(scoreOutOfTen), cx - radius, cy - fontSize / 2 - 1, { width: radius * 2, align: "center" });
}

function suggestionLine(doc, text, x, width) {
  doc.x = x;
  doc.fontSize(10).font("Helvetica-Bold").fillColor(GOLD)
    .text("›  ", { continued: true, lineGap: 3, width });
  doc.font("Helvetica").fillColor(BODY).text(text, { lineGap: 3, width });
}

function buildFeedbackPdf(feedback, res) {
  const doc = new PDFDocument({ margin: 0, size: "A4" });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin;

  function ensureSpace(height) {
    if (doc.y + height > bottomLimit) {
      doc.addPage();
      doc.y = margin;
    }
    doc.x = margin;
  }

  // ---- Brand header bar ----
  const barHeight = 60;
  doc.rect(0, 0, pageWidth, barHeight).fill(NAVY);
  doc.fontSize(16).font("Helvetica-Bold")
    .fillColor("#ffffff").text("Elevate Your ", margin, barHeight / 2 - 8, { continued: true })
    .fillColor(GOLD).text("Story");
  doc.fontSize(10).font("Helvetica").fillColor(GRAY)
    .text("StoryWallahs", pageWidth - margin - 160, barHeight / 2 - 5, { width: 160, align: "right" });

  // ---- Title row: report title (left) + StoryWallahs logotype (right) ----
  const titleY = barHeight + 26;
  const logoWidth = contentWidth * 0.34;
  const logoX = pageWidth - margin - logoWidth;
  const titleWidth = contentWidth - logoWidth - 16;

  doc.fontSize(21).font("Times-Roman").fillColor(HEADING)
    .text("Story Assessment Report", margin, titleY, { width: titleWidth });
  doc.fontSize(15).font("Times-Bold").fillColor(HEADING)
    .text("StoryWallahs", logoX, titleY + 2, { width: logoWidth, align: "right" });
  doc.fontSize(9).font("Times-Italic").fillColor(MUTED)
    .text("Elevate Your Story", logoX, titleY + 22, { width: logoWidth, align: "right" });

  // ---- Meta line: Speaker / Context / Date ----
  doc.y = titleY + 48;
  doc.x = margin;
  doc.fontSize(10).font("Helvetica");
  doc.fillColor(MUTED).text("Speaker: ", margin, doc.y, { continued: true });
  doc.font("Helvetica-Bold").fillColor(BODY).text(feedback.speakerName || "—", { continued: true });
  doc.font("Helvetica").fillColor(MUTED).text("      Context: ", { continued: true });
  doc.font("Helvetica-Bold").fillColor(BODY).text(feedback.context || "—", { continued: true });
  doc.font("Helvetica").fillColor(MUTED).text("      Date: ", { continued: true });
  doc.font("Helvetica-Bold").fillColor(BODY).text(formatDate(feedback.generatedAt));

  // ---- Divider ----
  doc.moveDown(0.9);
  doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).lineWidth(1).strokeColor(BORDER).stroke();
  doc.moveDown(1.2);
  doc.x = margin;

  // ---- Thumbnail strip — real frames pulled from the speaker's own video ----
  if (feedback.frames && feedback.frames.length) {
    const thumbCount = feedback.frames.length;
    const gap = 10;
    const thumbWidth = (contentWidth - gap * (thumbCount - 1)) / thumbCount;
    const thumbHeight = thumbWidth * 0.62;
    const rowY = doc.y;
    let x = margin;
    feedback.frames.forEach((frame) => {
      try {
        doc.image(frame.image, x, rowY, { width: thumbWidth, height: thumbHeight });
      } catch {
        // skip frames that fail to embed rather than breaking the layout
      }
      x += thumbWidth + gap;
    });
    doc.y = rowY + thumbHeight + 26;
    doc.x = margin;
  }

  // ---- Overall storytelling score card ----
  const cardPadding = 24;
  const ringRadius = 32;
  const overallTextX = margin + cardPadding + ringRadius * 2 + 26;
  const overallTextWidth = contentWidth - cardPadding * 2 - (ringRadius * 2 + 26);

  const overallParas = (feedback.overallSummary || "")
    .split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  doc.fontSize(13).font("Times-Bold");
  let estOverallHeight = doc.heightOfString("Overall storytelling score  out of 10", { width: overallTextWidth }) + 8;
  doc.fontSize(10.5).font("Helvetica");
  overallParas.forEach((p) => { estOverallHeight += doc.heightOfString(p, { width: overallTextWidth - 14, lineGap: 3 }) + 10; });
  estOverallHeight = Math.max(estOverallHeight, ringRadius * 2) + cardPadding * 2;
  ensureSpace(estOverallHeight + 28);

  const cardTop = doc.y;
  const innerTop = cardTop + cardPadding;
  doc.x = overallTextX;
  doc.y = innerTop;

  doc.fontSize(13).font("Times-Bold").fillColor(HEADING)
    .text("Overall storytelling score  ", overallTextX, innerTop, { continued: true, width: overallTextWidth });
  doc.font("Times-Italic").fontSize(10.5).fillColor(MUTED).text("out of 10");
  doc.moveDown(0.55);

  overallParas.forEach((para, i) => {
    if (i === 0) {
      doc.x = overallTextX;
      doc.fontSize(10.5).font("Helvetica").fillColor(BODY)
        .text(para, overallTextX, doc.y, { width: overallTextWidth, lineGap: 3 });
      doc.moveDown(0.6);
    } else {
      const calloutX = overallTextX + 14;
      const calloutWidth = overallTextWidth - 14;
      const calloutTop = doc.y;
      doc.fontSize(10.5).font("Helvetica").fillColor(BODY)
        .text(para, calloutX, calloutTop, { width: calloutWidth, lineGap: 3 });
      const calloutBottom = doc.y;
      doc.lineWidth(2.4).strokeColor(GOLD)
        .moveTo(overallTextX, calloutTop - 1).lineTo(overallTextX, calloutBottom + 1).stroke();
      doc.moveDown(0.5);
    }
  });

  const overallTextBottom = doc.y;
  const overallContentHeight = Math.max(overallTextBottom - innerTop, ringRadius * 2);
  const ringCx = margin + cardPadding + ringRadius;
  const ringCy = innerTop + overallContentHeight / 2;
  scoreRing(doc, ringCx, ringCy, ringRadius, toTen(feedback.overallScore));

  const cardBottom = Math.max(overallTextBottom, ringCy + ringRadius) + cardPadding;
  doc.roundedRect(margin, cardTop, contentWidth, cardBottom - cardTop, 10)
    .lineWidth(1).strokeColor(BORDER).stroke();

  doc.x = margin;
  doc.y = cardBottom + 26;

  // ---- Six category cards ----
  const secPadding = 20;
  const secRingRadius = 22;
  const secTextX = margin + secPadding + secRingRadius * 2 + 20;
  const secTextWidth = contentWidth - secPadding * 2 - (secRingRadius * 2 + 20);

  feedback.sections.forEach((section) => {
    // Pre-measure so the card never splits awkwardly across a page break.
    doc.fontSize(13).font("Times-Bold");
    let estHeight = doc.heightOfString(section.title, { width: secTextWidth, lineGap: 2 }) + 6;
    doc.fontSize(10.5).font("Helvetica");
    estHeight += doc.heightOfString(section.summary, { width: secTextWidth, lineGap: 3 });
    if (section.coachingSuggestions && section.coachingSuggestions.length) {
      doc.fontSize(9.5).font("Helvetica-Bold");
      estHeight += doc.heightOfString("COACHING SUGGESTIONS", { width: secTextWidth }) + 14;
      doc.fontSize(10).font("Helvetica");
      section.coachingSuggestions.forEach((tip) => {
        estHeight += doc.heightOfString(tip, { width: secTextWidth - 16, lineGap: 3 }) + 4;
      });
    }
    estHeight = Math.max(estHeight, secRingRadius * 2) + secPadding * 2;
    ensureSpace(estHeight + 18);

    const secTop = doc.y;
    const innerSecTop = secTop + secPadding;

    doc.fontSize(13).font("Times-Bold").fillColor(HEADING)
      .text(section.title, secTextX, innerSecTop, { width: secTextWidth, lineGap: 2 });
    doc.moveDown(0.3);
    doc.x = secTextX;
    doc.fontSize(10.5).font("Helvetica").fillColor(BODY)
      .text(section.summary, secTextX, doc.y, { width: secTextWidth, lineGap: 3 });

    if (section.coachingSuggestions && section.coachingSuggestions.length) {
      doc.moveDown(0.5);
      doc.fontSize(9.5).font("Helvetica-Bold").fillColor(GOLD)
        .text("COACHING SUGGESTIONS", secTextX, doc.y, { width: secTextWidth, characterSpacing: 0.6 });
      doc.moveDown(0.3);
      section.coachingSuggestions.forEach((tip) => suggestionLine(doc, tip, secTextX, secTextWidth));
    }

    const secTextBottom = doc.y;
    const secContentHeight = Math.max(secTextBottom - innerSecTop, secRingRadius * 2);
    const secRingCx = margin + secPadding + secRingRadius;
    const secRingCy = innerSecTop + secContentHeight / 2;
    scoreRing(doc, secRingCx, secRingCy, secRingRadius, toTen(section.score));

    const secBottom = Math.max(secTextBottom, secRingCy + secRingRadius) + secPadding;
    doc.roundedRect(margin, secTop, contentWidth, secBottom - secTop, 10)
      .lineWidth(1).strokeColor(BORDER).stroke();

    doc.x = margin;
    doc.y = secBottom + 16;
  });

  // ---- Priority focus for next session ----
  if (feedback.priorityFocus) {
    const pfPadding = 20;
    const barGap = 16;
    const pfTextX = margin + pfPadding + barGap;
    const pfTextWidth = contentWidth - pfPadding * 2 - barGap;

    doc.fontSize(12.5).font("Times-Bold");
    let estPfHeight = doc.heightOfString("Priority Focus for Next Session", { width: pfTextWidth }) + 8;
    doc.fontSize(10.5).font("Helvetica");
    estPfHeight += doc.heightOfString(feedback.priorityFocus, { width: pfTextWidth, lineGap: 3 });
    estPfHeight += pfPadding * 2;
    ensureSpace(estPfHeight + 18);

    const pfTop = doc.y;
    const innerPfTop = pfTop + pfPadding;

    doc.fontSize(12.5).font("Times-Bold").fillColor(HEADING)
      .text("Priority Focus for Next Session", pfTextX, innerPfTop, { width: pfTextWidth });
    doc.moveDown(0.4);
    doc.x = pfTextX;
    doc.fontSize(10.5).font("Helvetica").fillColor(BODY)
      .text(feedback.priorityFocus, pfTextX, doc.y, { width: pfTextWidth, lineGap: 3 });

    const pfTextBottom = doc.y;
    doc.lineWidth(3).strokeColor(GOLD)
      .moveTo(margin + pfPadding, innerPfTop - 2).lineTo(margin + pfPadding, pfTextBottom + 2).stroke();

    const pfBottom = pfTextBottom + pfPadding;
    doc.roundedRect(margin, pfTop, contentWidth, pfBottom - pfTop, 10)
      .lineWidth(1).strokeColor(BORDER).stroke();

    doc.x = margin;
    doc.y = pfBottom + 22;
  }

  // ---- Moments from the video — larger gallery shots ----
  if (feedback.frames && feedback.frames.length) {
    const displayWidth = 260;
    const centerX = margin + (contentWidth - displayWidth) / 2;
    const captionGap = 4;
    const captionHeight = 14;
    const blockGap = 14;

    // Reserve room for the heading AND the first photo together so the
    // heading never gets stranded alone at the bottom of a page.
    let firstBlockHeight = displayWidth * 0.6 + captionGap + captionHeight;
    try {
      const firstImg = doc.openImage(feedback.frames[0].image);
      firstBlockHeight = (displayWidth / firstImg.width) * firstImg.height + captionGap + captionHeight;
    } catch {
      // use the fallback estimate
    }
    doc.fontSize(13).font("Times-Bold");
    const headingHeight = doc.heightOfString("Moments from the Video", { width: contentWidth });
    ensureSpace(headingHeight + 14 + firstBlockHeight);

    doc.fontSize(13).font("Times-Bold").fillColor(HEADING)
      .text("Moments from the Video", margin, doc.y);
    doc.moveDown(0.6);

    feedback.frames.forEach((frame) => {
      let displayHeight = displayWidth * 0.6;
      try {
        const img = doc.openImage(frame.image);
        displayHeight = (displayWidth / img.width) * img.height;
      } catch {
        return;
      }

      const blockHeight = displayHeight + captionGap + captionHeight;
      ensureSpace(blockHeight);

      try {
        doc.image(frame.image, centerX, doc.y, { width: displayWidth, height: displayHeight });
      } catch {
        return;
      }

      const captionY = doc.y + displayHeight + captionGap;
      doc.fontSize(9).fillColor(MUTED).font("Helvetica")
        .text(formatTimestamp(frame.timestamp), margin, captionY, { width: contentWidth, align: "center" });

      doc.y = captionY + captionHeight + blockGap;
      doc.x = margin;
    });
  }

  doc.end();
}

module.exports = { buildFeedbackPdf };
