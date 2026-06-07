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
    speech: categorySchema(
      "1-2 sentences assessing clarity of speech and voice modulation — articulation, pacing, " +
      "filler words, vocal energy, tone, and how well the voice's pitch/volume/emphasis varied " +
      "to keep the listener engaged."
    ),
    bodyLanguage: categorySchema(
      "1-2 sentences assessing body language and facial expression — eye contact with the " +
      "camera, posture, framing, facial expressiveness, and use of gestures."
    ),
    contentStructure: categorySchema(
      "1-2 sentences assessing content structure — quality of the opening (does it hook the " +
      "audience), impact of the closing, coherence and logical flow of ideas, persuasion through " +
      "emotional appeal/logic/credibility (ethos/pathos/logos), and general language quality."
    )
  },
  required: ["speech", "bodyLanguage", "contentStructure"]
};

const SYSTEM_PROMPT = `You are an expert communication and presentation coach. You will be given a video
of someone speaking, along with its transcript (and possibly the speaker's name and the context/topic
of the talk). Watch the video and read the transcript, then assess the speaker across exactly three
categories:

- Clarity of speech and voice modulation: articulation, pacing, filler-word usage, vocal energy,
  emotional tone, and how well pitch/volume/emphasis varied to keep the listener engaged
- Body language and facial expression: eye contact with the camera, posture, framing,
  facial expressiveness, and use of gestures
- Content structure: a strong opening that hooks the audience, an impactful closing, coherence and
  logical flow of ideas, and persuasion through emotional appeal, logic, and credibility — plus
  general language quality (grammar, vocabulary, clarity)

For each category, give a score from 0-100, a short 1-2 sentence summary, and 0-3 coaching
suggestions specific to THAT category. Keep every coaching suggestion to ONE short, punchy
sentence (about 8-14 words) — specific and actionable (reference actual moments, phrases, or
visual details where possible), never a vague platitude. Only include suggestions that truly add
value; if the speaker is already excellent in a category, it's fine to return an empty list rather
than inventing generic advice.

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
 * to Gemini and returns structured speech/body-language/content-structure scores,
 * summaries, and per-category coaching suggestions.
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
