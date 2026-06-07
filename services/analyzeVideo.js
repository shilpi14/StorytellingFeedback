const { extractAudio } = require("./mediaExtraction");
const { transcribeAudio } = require("./transcription");
const { analyzeVideoWithGemini } = require("./feedbackAnalysis");

/**
 * Runs the full pipeline — Deepgram transcription, then a single Gemini call
 * that watches the video and reads the transcript to produce structured
 * tone/delivery/visual/content feedback — assembled into the PDF's expected shape.
 */
async function analyzeVideo(videoBuffer, fileName, mimeType) {
  const audioBuffer = await extractAudio(videoBuffer);
  const transcription = await transcribeAudio(audioBuffer);

  const feedback = await analyzeVideoWithGemini({
    videoBuffer,
    mimeType,
    fileName,
    transcript: transcription.transcript,
    durationSeconds: transcription.durationSeconds
  });

  const overallScore = Math.round(
    (feedback.tone.score + feedback.delivery.score + feedback.visual.score + feedback.content.score) / 4
  );

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    overallScore,
    sections: [
      { title: "Tone", score: feedback.tone.score, summary: feedback.tone.summary },
      { title: "Speech & Delivery", score: feedback.delivery.score, summary: feedback.delivery.summary },
      { title: "Visual & Body Language", score: feedback.visual.score, summary: feedback.visual.summary },
      { title: "Content & Messaging", score: feedback.content.score, summary: feedback.content.summary }
    ],
    strengths: feedback.strengths,
    improvements: feedback.improvements
  };
}

module.exports = { analyzeVideo };
