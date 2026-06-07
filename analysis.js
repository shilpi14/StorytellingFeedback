// Mock analysis pipeline. Replace generateFeedback's body with real
// transcription + vision/LLM calls (e.g. Claude) when API keys are available.
// The shape of the returned object is the contract the PDF generator relies on.

const TONE_OPTIONS = ["Confident", "Conversational", "Energetic", "Measured", "Hesitant"];
const STRENGTHS_POOL = [
  "Clear articulation of the main point early on",
  "Good vocal variety that kept the delivery engaging",
  "Strong eye contact with the camera throughout",
  "Logical structure that was easy to follow",
  "Effective use of pauses to emphasize key ideas"
];
const IMPROVEMENT_POOL = [
  "Reduce filler words such as 'um' and 'like'",
  "Slow down during the most important points",
  "Add a stronger closing that summarizes the key takeaway",
  "Use more hand gestures to reinforce key moments",
  "Vary pacing to avoid a monotone delivery"
];

function pickRandom(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomScore(min = 60, max = 95) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateFeedback(fileName) {
  const scores = {
    tone: randomScore(),
    delivery: randomScore(),
    visual: randomScore(),
    content: randomScore()
  };
  const overall = Math.round((scores.tone + scores.delivery + scores.visual + scores.content) / 4);

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    overallScore: overall,
    sections: [
      {
        title: "Tone",
        score: scores.tone,
        summary: `Overall tone came across as ${TONE_OPTIONS[Math.floor(Math.random() * TONE_OPTIONS.length)]}.`
      },
      {
        title: "Speech & Delivery",
        score: scores.delivery,
        summary: "Pace, clarity, and vocal energy were assessed from the audio track."
      },
      {
        title: "Visual & Body Language",
        score: scores.visual,
        summary: "Eye contact, posture, and framing were assessed from the video frames."
      },
      {
        title: "Content & Messaging",
        score: scores.content,
        summary: "Structure, clarity of key points, and overall persuasiveness were assessed from the transcript."
      }
    ],
    strengths: pickRandom(STRENGTHS_POOL, 3),
    improvements: pickRandom(IMPROVEMENT_POOL, 3)
  };
}

module.exports = { generateFeedback };
