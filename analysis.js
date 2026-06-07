// Mock analysis pipeline. Used when Deepgram/Gemini API keys aren't configured.
// The shape of the returned object is the contract the PDF generator relies on.

const TONE_OPTIONS = ["Confident", "Conversational", "Energetic", "Measured", "Hesitant"];
const STRENGTHS_POOL = [
  "Clear articulation of the main point early on",
  "Good vocal variety that kept the delivery engaging",
  "Strong eye contact with the camera throughout",
  "A logical structure that was easy to follow",
  "An impactful closing that reinforced the key takeaway",
  "Effective use of pauses to emphasize key ideas"
];
const IMPROVEMENT_POOL = [
  "Reduce filler words such as 'um' and 'like'",
  "Slow down during the most important points",
  "Add a stronger opening that hooks the audience faster",
  "Add a stronger closing that summarizes the key takeaway",
  "Use more hand gestures to reinforce key moments",
  "Vary pacing to avoid a monotone delivery",
  "Lean more on emotional appeal alongside the logical points"
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
    speech: randomScore(),
    bodyLanguage: randomScore(),
    contentStructure: randomScore()
  };
  const overall = Math.round((scores.speech + scores.bodyLanguage + scores.contentStructure) / 3);

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    overallScore: overall,
    sections: [
      {
        title: "Clarity of Speech & Voice Modulation",
        score: scores.speech,
        summary: `Pace, articulation, and vocal variety came across as ${TONE_OPTIONS[Math.floor(Math.random() * TONE_OPTIONS.length)].toLowerCase()}, based on the audio track.`
      },
      {
        title: "Body Language & Facial Expression",
        score: scores.bodyLanguage,
        summary: "Eye contact, posture, framing, and facial expressiveness were assessed from the video frames."
      },
      {
        title: "Content Structure",
        score: scores.contentStructure,
        summary: "The opening, closing, coherence of ideas, and persuasive use of logic, emotion, and credibility were assessed from the transcript."
      }
    ],
    strengths: pickRandom(STRENGTHS_POOL, 3),
    improvements: pickRandom(IMPROVEMENT_POOL, 3)
  };
}

module.exports = { generateFeedback };
