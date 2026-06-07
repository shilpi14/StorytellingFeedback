const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager, FileState } = require("@google/generative-ai/server");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

function categorySchema(summaryDescription) {
  return {
    type: SchemaType.OBJECT,
    properties: {
      score: { type: SchemaType.INTEGER, description: "0-100" },
      summary: { type: SchemaType.STRING, description: summaryDescription },
      coachingSuggestions: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description:
          "0 to 3 coaching tips for this category only. Each tip MUST be a single short sentence " +
          "(roughly 8-14 words) — specific and actionable, not a generic platitude. Omit this " +
          "category's suggestions (use an empty array) if the speaker is already strong here and " +
          "there's nothing meaningfully actionable to add — don't pad with filler just to reach 3."
      }
    },
    required: ["score", "summary", "coachingSuggestions"]
  };
}

const FEEDBACK_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    overallSummary: {
      type: SchemaType.STRING,
      description:
        "1-2 short paragraphs (separated by a blank line) giving an overall impression of the " +
        "speaker's storytelling — their general delivery style, presence, and the big-picture " +
        "takeaway from this video."
    },
    openingHook: categorySchema(
      "1-2 sentences on how the talk opens — does the title/intro create context, and does the " +
      "hook grab the audience's attention right away?"
    ),
    narrativeStructure: categorySchema(
      "1-2 sentences on the story's structure — clear beginning/middle/end, logical flow, use of " +
      "credibility markers or proof points, and build toward a climactic moment."
    ),
    bodyLanguagePresence: categorySchema(
      "1-2 sentences on body language and presence — posture, gestures, movement, and overall " +
      "expressiveness/energy."
    ),
    vocalDeliveryPacing: categorySchema(
      "1-2 sentences on vocal delivery and pacing — vocal variety, energy, pauses, and emotional range."
    ),
    storyContent: categorySchema(
      "1-2 sentences on the substance of the story/content — relevance of the topic, use of " +
      "examples or evidence, and how well it establishes credibility."
    ),
    landingTakeaway: categorySchema(
      "1-2 sentences on how the talk concludes — clarity and impact of the closing, and whether " +
      "it leaves a memorable, actionable takeaway."
    ),
    priorityFocus: {
      type: SchemaType.STRING,
      description:
        "ONE short paragraph (2-3 sentences) naming the single most impactful thing this speaker " +
        "should focus on improving before their next session — the one change that would make the " +
        "biggest difference."
    }
  },
  required: [
    "overallSummary",
    "openingHook",
    "narrativeStructure",
    "bodyLanguagePresence",
    "vocalDeliveryPacing",
    "storyContent",
    "landingTakeaway",
    "priorityFocus"
  ]
};

const SYSTEM_PROMPT = `You are an expert storytelling and presentation coach for StoryWallahs. You will be
given a video of someone telling a story or giving a talk, along with its transcript (and possibly the
speaker's name and the context/topic). Watch the video and read the transcript, then assess the speaker
across exactly six categories, in this order:

1. Opening & Hook — does the intro create context and immediately grab attention?
2. Narrative Structure — clear beginning/middle/end, logical flow, credibility markers, build to a climax
3. Body Language & Presence — posture, gestures, movement, expressiveness, energy
4. Vocal Delivery & Pacing — vocal variety, energy, pauses, emotional range
5. Story Content — relevance, use of examples/evidence, credibility
6. Landing & Takeaway — clarity and impact of the closing, memorable takeaway

For each category, give a score from 0-100, a short 1-2 sentence summary, and 0-3 coaching
suggestions specific to THAT category. Keep every coaching suggestion to ONE short, punchy
sentence (about 8-14 words) — specific and actionable (reference actual moments, phrases, or
visual details where possible), never a vague platitude. Only include suggestions that truly add
value; if the speaker is already excellent in a category, it's fine to return an empty list rather
than inventing generic advice.

Also provide:
- overallSummary: 1-2 short paragraphs (separated by a blank line) giving the big-picture impression
- priorityFocus: ONE short paragraph naming the single most impactful thing to focus on next

Respond only with the structured JSON described by the schema.`;

/**
 * Uploads the video to Gemini's File API and waits until it finishes processing.
 */
async function uploadVideo(videoBuffer, mimeType, displayName) {
  const { file } = await fileManager.uploadFile(videoBuffer, { mimeType, displayName });

  let current = file;
  while (current.state === FileState.PROCESSING) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    current = await fileManager.getFile(file.name);
  }

  if (current.state !== FileState.ACTIVE) {
    throw new Error(`Gemini could not process the uploaded video (state: ${current.state}).`);
  }

  return current;
}

/**
 * Sends the uploaded video plus its transcript (and optional speaker name / context)
 * to Gemini and returns the structured six-category storytelling assessment.
 */
async function analyzeVideoWithGemini({
  videoBuffer,
  mimeType,
  fileName,
  transcript,
  durationSeconds,
  speakerName,
  context
}) {
  const uploaded = await uploadVideo(videoBuffer, mimeType, fileName);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: FEEDBACK_SCHEMA
    },
    systemInstruction: SYSTEM_PROMPT
  });

  const contextLines = [];
  if (speakerName) contextLines.push(`Speaker name: ${speakerName}`);
  if (context) contextLines.push(`Context / topic of this talk: ${context}`);
  const contextNote = contextLines.length ? `${contextLines.join("\n")}\n\n` : "";

  const transcriptNote = transcript
    ? `${contextNote}Transcript:\n"""\n${transcript}\n"""${durationSeconds ? `\n\nDuration: ${Math.round(durationSeconds)} seconds` : ""}`
    : `${contextNote}No transcript was available — base your assessment on the video alone.`;

  const result = await model.generateContent([
    { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
    { text: transcriptNote }
  ]);

  await fileManager.deleteFile(uploaded.name).catch(() => {});

  return JSON.parse(result.response.text());
}

module.exports = { analyzeVideoWithGemini };
