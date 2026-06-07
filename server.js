require("dotenv").config();

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const { generateFeedback } = require("./analysis");
const { analyzeVideo } = require("./services/analyzeVideo");
const { extractFrames } = require("./services/mediaExtraction");
const { buildFeedbackPdf } = require("./pdf");

// Real analysis needs both API keys configured (not the placeholder values).
const apisConfigured =
  process.env.DEEPGRAM_API_KEY &&
  process.env.GEMINI_API_KEY &&
  !process.env.DEEPGRAM_API_KEY.startsWith("your-") &&
  !process.env.GEMINI_API_KEY.startsWith("your-");

if (!apisConfigured) {
  console.warn("Deepgram/Gemini API keys not configured — using mock analysis. See .env.example.");
}

// Videos are buffered fully into memory (multer.memoryStorage) before processing,
// so the cap has to leave headroom for Node + ffmpeg + the Gemini upload on a
// memory-constrained host. 200MB comfortably covers a multi-minute storytelling
// clip while keeping the server responsive rather than stalling on huge uploads.
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

// In-memory store of completed analyses, keyed by report id.
const reports = new Map();

app.use(express.static("public"));

function handleUpload(req, res, next) {
  upload.single("video")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
      return res.status(413).json({
        error: `That video is larger than our ${maxMb}MB limit. Please trim it to a shorter clip (a focused 1-3 minute story works best) and try again.`
      });
    }
    if (err) {
      console.error("Upload failed:", err);
      return res.status(400).json({ error: "We couldn't read that upload. Please try a different video file." });
    }
    next();
  });
}

app.post("/api/analyze", handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file uploaded." });
  }
  if (!req.file.mimetype.startsWith("video/")) {
    return res.status(400).json({ error: "Uploaded file must be a video." });
  }

  const speakerName = (req.body.speakerName || "").trim();
  const context = (req.body.context || "").trim();

  try {
    const feedback = apisConfigured
      ? await analyzeVideo(req.file.buffer, req.file.originalname, req.file.mimetype, { speakerName, context })
      : generateFeedback(req.file.originalname, { speakerName, context });

    // Grab a few real snapshots from the speaker's own video for the PDF —
    // independent of mock vs. real analysis, since it's just local ffmpeg work.
    const frames = await extractFrames(req.file.buffer, 4).catch((err) => {
      console.error("Frame extraction failed:", err);
      return [];
    });

    const id = crypto.randomUUID();
    // Keep the (potentially large) image buffers server-side only — the PDF route
    // needs them, but the JSON response to the browser should stay lightweight.
    reports.set(id, { ...feedback, frames });
    res.json({ id, feedback });
  } catch (err) {
    console.error("Analysis failed:", err);
    res.status(502).json({ error: "We couldn't analyze this video. Please try again." });
  }
});

// Friendly download name like "Ameen Story Report 2026-06-07_1415.pdf" — falls
// back to "Story Report ..." when no speaker name was given. Stripped down to
// filesystem/header-safe characters so it survives across OSes and browsers.
function buildReportFilename(feedback) {
  const speaker = (feedback.speakerName || "").trim();
  const stamp = new Date(feedback.generatedAt || Date.now())
    .toISOString()
    .slice(0, 16)
    .replace("T", "_")
    .replace(/:/g, "");

  const raw = speaker ? `${speaker} Story Report ${stamp}` : `Story Report ${stamp}`;
  const safe = raw.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, " ").trim();
  return `${safe || "Story Report"}.pdf`;
}

app.get("/api/report/:id/pdf", (req, res) => {
  const feedback = reports.get(req.params.id);
  if (!feedback) {
    return res.status(404).send("Report not found.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${buildReportFilename(feedback)}"`);
  buildFeedbackPdf(feedback, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video Analyzer running at http://localhost:${PORT}`);
});
