// Mock analysis pipeline. Used when Deepgram/Gemini API keys aren't configured.
// The shape of the returned object is the contract the PDF generator relies on —
// each category has a score, a short summary, and 0-3 coaching suggestions.

const TONE_OPTIONS = ["Confident", "Conversational", "Energetic", "Measured", "Hesitant"];

const SPEECH_TIPS = [
  "Cut filler words like 'um' and 'like'.",
  "Slow down on your most important points.",
  "Vary your pitch more to avoid sounding flat.",
  "Use deliberate pauses to let key ideas land."
];
const BODY_TIPS = [
  "Add a few more hand gestures at key moments.",
  "Relax your shoulders for a more natural posture.",
  "Let your facial expressions match your message's energy.",
  "Hold eye contact with the camera a bit longer."
];
const CONTENT_TIPS = [
  "Open with a sharper hook to grab attention fast.",
  "Tighten your closing into one memorable takeaway.",
  "Add an emotional beat alongside your logical points.",
  "Loop back to your opening idea for better coherence."
];

function pickRandom(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomScore(min = 60, max = 95) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Returns 0-3 suggestions, weighted toward fewer (mirrors how a real coach
// wouldn't pad every category with the maximum every time).
function randomSuggestions(pool) {
  const counts = [0, 1, 1, 2, 2, 3];
  const count = counts[Math.floor(Math.random() * counts.length)];
  return pickRandom(pool, count);
}

function generateFeedback(fileName, { speakerName = "", context = "" } = {}) {
  const scores = {
    speech: randomScore(),
    bodyLanguage: randomScore(),
    contentStructure: randomScore()
  };
  const overall = Math.round((scores.speech + scores.bodyLanguage + scores.contentStructure) / 3);

  return {
    fileName,
    speakerName,
    context,
    generatedAt: new Date().toISOString(),
    overallScore: overall,
    sections: [
      {
        title: "Clarity of Speech & Voice Modulation",
        score: scores.speech,
        summary: `Pace, articulation, and vocal variety came across as ${TONE_OPTIONS[Math.floor(Math.random() * TONE_OPTIONS.length)].toLowerCase()}, based on the audio track.`,
        coachingSuggestions: randomSuggestions(SPEECH_TIPS)
      },
      {
        title: "Body Language & Facial Expression",
        score: scores.bodyLanguage,
        summary: "Eye contact, posture, framing, and facial expressiveness were assessed from the video frames.",
        coachingSuggestions: randomSuggestions(BODY_TIPS)
      },
      {
        title: "Content Structure",
        score: scores.contentStructure,
        summary: "The opening, closing, coherence of ideas, and persuasive use of logic, emotion, and credibility were assessed from the transcript.",
        coachingSuggestions: randomSuggestions(CONTENT_TIPS)
      }
    ]
  };
}

module.exports = { generateFeedback };
