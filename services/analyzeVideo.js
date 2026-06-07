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
    (feedback.speech.score + feedback.bodyLanguage.score + feedback.contentStructure.score) / 3
  );

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    overallScore,
    sections: [
      { title: "Clarity of Speech & Voice Modulation", score: feedback.speech.score, summary: feedback.speech.summary },
      { title: "Body Language & Facial Expression", score: feedback.bodyLanguage.score, summary: feedback.bodyLanguage.summary },
      { title: "Content Structure", score: feedback.contentStructure.score, summary: feedback.contentStructure.summary }
    ],
    strengths: feedback.strengths,
    improvements: feedback.improvements
  };
}

module.exports = { analyzeVideo };
