// Mock analysis pipeline. Used when Deepgram/Gemini API keys aren't configured.
// The shape of the returned object is the contract the PDF generator relies on —
// an overall summary + score, five named sections (each with a score, a short
// summary, and 0-3 coaching suggestions), and a closing priority-focus paragraph.

const OPENING_TIPS = [
  "Open with a vivid moment instead of background context.",
  "Trim the warm-up — get to the hook within seconds.",
  "Tease the stakes early so listeners lean in.",
  "Ask a question that pulls the audience into the scene."
];
const BODY_TIPS = [
  "Add a few more hand gestures at key moments.",
  "Relax your shoulders for a more natural, open posture.",
  "Let your facial expressions match your story's emotional beats.",
  "Hold eye contact with the camera a touch longer."
];
const VOICE_TIPS = [
  "Slow down on your most important lines for emphasis.",
  "Use a deliberate pause right before the turning point.",
  "Vary your pitch more to avoid sounding flat.",
  "Let your volume rise and fall with the story's energy."
];
const NARRATIVE_TIPS = [
  "Mark the turning point more clearly before the resolution.",
  "Add one concrete detail to ground the middle section.",
  "Tighten the middle so momentum carries through to the end.",
  "Signal the shift from setup to conflict more deliberately."
];
const CLOSING_TIPS = [
  "End on the image that best captures your message.",
  "Land the takeaway in one short, quotable line.",
  "Circle back to your opening for a satisfying close.",
  "Resist adding new ideas after your closing line."
];

const OVERALL_SUMMARIES = [
  "This speaker brings a warm, conversational presence and a story worth telling — the raw material for something memorable is clearly there.\n\nWith a few focused adjustments to structure and delivery, this talk could move from solid to genuinely compelling.",
  "There's real charm and authenticity in this delivery, and the story has a clear emotional core that audiences will connect with.\n\nSharpening a handful of moments — the opening, the pacing, the close — would let that authenticity land with even more impact."
];

const PRIORITY_FOCUSES = [
  "Before the next session, focus on the opening — a sharper hook in the first few seconds will pull listeners in and set up everything that follows.",
  "The single highest-leverage change for next time is tightening the close: landing on one clear, memorable takeaway will make the whole story stick.",
  "The most valuable thing to work on next is pacing — adding deliberate pauses around key moments will let the story's best lines truly land."
];

function pickRandom(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function pickOne(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
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

const SECTION_DEFS = [
  {
    title: "Opening and Hook",
    tips: OPENING_TIPS,
    summary: "The opening sets up context, though the hook could grab attention a little faster."
  },
  {
    title: "Body Language and Facial Expressions",
    tips: BODY_TIPS,
    summary: "Posture, gestures, and expressiveness came across as natural and engaged on camera."
  },
  {
    title: "Voice Tonality and Modulation",
    tips: VOICE_TIPS,
    summary: "Pace and vocal energy were steady, with room for more variety around the key moments."
  },
  {
    title: "Narrative Structure and Coherence",
    tips: NARRATIVE_TIPS,
    summary: "The story moves through a clear beginning, middle, and end with a recognizable turning point."
  },
  {
    title: "Closing and Takeaway",
    tips: CLOSING_TIPS,
    summary: "The closing wraps up the story, and a slightly sharper final line would make it more memorable."
  }
];

function generateFeedback(fileName, { speakerName = "", context = "" } = {}) {
  const sections = SECTION_DEFS.map((def) => {
    const score = randomScore();
    return {
      title: def.title,
      score,
      summary: def.summary,
      coachingSuggestions: randomSuggestions(def.tips)
    };
  });

  const overallScore = Math.round(
    sections.reduce((sum, section) => sum + section.score, 0) / sections.length
  );

  return {
    fileName,
    speakerName,
    context,
    generatedAt: new Date().toISOString(),
    overallScore,
    overallSummary: pickOne(OVERALL_SUMMARIES),
    priorityFocus: pickOne(PRIORITY_FOCUSES),
    sections
  };
}

module.exports = { generateFeedback };
