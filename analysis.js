// Mock analysis pipeline. Used when Deepgram/Gemini API keys aren't configured.
// The shape of the returned object is the contract the PDF generator relies on —
// each category has a score, a short summary, and 0-3 coaching suggestions.

const TONE_OPTIONS = ["Confident", "Conversational", "Energetic", "Measured", "Hesitant"];

const SPEECH_TIPS = [
  "Try to reduce filler words such as 'um' and 'like' for a crisper delivery.",
  "Slowing down slightly during the most important points would add emphasis.",
  "Varying pitch and volume more would help avoid a monotone feel.",
  "Using more deliberate pauses would give key ideas room to land."
];
const BODY_TIPS = [
  "A few more hand gestures at key moments would help reinforce the message.",
  "Relaxing the shoulders a little would make the posture feel more natural.",
  "More variation in facial expression would add warmth to the delivery.",
  "Holding eye contact with the camera a touch longer would build connection."
];
const CONTENT_TIPS = [
  "A stronger opening line would help hook the audience even faster.",
  "The closing could be tightened into a single, more memorable takeaway.",
  "Leaning more on emotional appeal alongside the logical points would make the message land harder.",
  "Tying the middle section back to the opening idea would improve coherence."
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
