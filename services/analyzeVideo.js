const { extractAudio } = require("./mediaExtraction");
const { transcribeAudio } = require("./transcription");
const { analyzeVideoWithGemini } = require("./feedbackAnalysis");

const SECTION_DEFS = [
  { key: "openingHook", title: "Opening & Hook" },
  { key: "narrativeStructure", title: "Narrative Structure" },
  { key: "bodyLanguagePresence", title: "Body Language & Presence" },
  { key: "vocalDeliveryPacing", title: "Vocal Delivery & Pacing" },
  { key: "storyContent", title: "Story Content" },
  { key: "landingTakeaway", title: "Landing & Takeaway" }
];

/**
 * Runs the full pipeline — Deepgram transcription, then a single Gemini call
 * that watches the video and reads the transcript to produce the StoryWallahs
 * six-category storytelling assessment (Opening & Hook / Narrative Structure /
 * Body Language & Presence / Vocal Delivery & Pacing / Story Content /
 * Landing & Takeaway), each with its own short summary plus 0-3 coaching
 * suggestions, an overall summary, and a closing priority focus — assembled
 * into the PDF's expected shape.
 */
async function analyzeVideo(videoBuffer, fileName, mimeType, { speakerName = "", context = "" } = {}) {
  const audioBuffer = await extractAudio(videoBuffer);
  const transcription = await transcribeAudio(audioBuffer);

  const feedback = await analyzeVideoWithGemini({
    videoBuffer,
    mimeType,
    fileName,
    transcript: transcription.transcript,
    durationSeconds: transcription.durationSeconds,
    speakerName,
    context
  });

  const sections = SECTION_DEFS.map(({ key, title }) => ({
    title,
    score: feedback[key].score,
    summary: feedback[key].summary,
    coachingSuggestions: feedback[key].coachingSuggestions || []
  }));

  const overallScore = Math.round(
    sections.reduce((sum, section) => sum + section.score, 0) / sections.length
  );

  return {
    fileName,
    speakerName,
    context,
    generatedAt: new Date().toISOString(),
    overallScore,
    overallSummary: feedback.overallSummary,
    priorityFocus: feedback.priorityFocus,
    sections
  };
}

module.exports = { analyzeVideo };
