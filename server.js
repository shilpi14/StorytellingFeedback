require("dotenv").config();

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const { generateFeedback } = require("./analysis");
const { analyzeVideo } = require("./services/analyzeVideo");
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

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// In-memory store of completed analyses, keyed by report id.
const reports = new Map();

app.use(express.static("public"));

app.post("/api/analyze", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file uploaded." });
  }
  if (!req.file.mimetype.startsWith("video/")) {
    return res.status(400).json({ error: "Uploaded file must be a video." });
  }

  try {
    const feedback = apisConfigured
      ? await analyzeVideo(req.file.buffer, req.file.originalname, req.file.mimetype)
      : generateFeedback(req.file.originalname);

    const id = crypto.randomUUID();
    reports.set(id, feedback);
    res.json({ id, feedback });
  } catch (err) {
    console.error("Analysis failed:", err);
    res.status(502).json({ error: "We couldn't analyze this video. Please try again." });
  }
});

app.get("/api/report/:id/pdf", (req, res) => {
  const feedback = reports.get(req.params.id);
  if (!feedback) {
    return res.status(404).send("Report not found.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="feedback-${req.params.id}.pdf"`);
  buildFeedbackPdf(feedback, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video Analyzer running at http://localhost:${PORT}`);
});
