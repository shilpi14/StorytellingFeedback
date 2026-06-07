const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager, FileState } = require("@google/generative-ai/server");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const FEEDBACK_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tone: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: { type: SchemaType.STRING, description: "1-2 sentences on the speaker's emotional tone." }
      },
      required: ["score", "summary"]
    },
    delivery: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description: "Assessment of pace, clarity, filler words, and vocal energy."
        }
      },
      required: ["score", "summary"]
    },
    visual: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description: "Assessment of eye contact, posture, framing, facial expression, and gestures."
        }
      },
      required: ["score", "summary"]
    },
    content: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description: "Assessment of structure (intro/body/conclusion), language quality, and messaging clarity."
        }
      },
      required: ["score", "summary"]
    },
    strengths: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Exactly 3 specific things the speaker did well, citing moments from the video or transcript."
    },
    improvements: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Exactly 3 specific, actionable suggestions for improvement."
    }
  },
  required: ["tone", "delivery", "visual", "content", "strengths", "improvements"]
};

const SYSTEM_PROMPT = `You are an expert communication and presentation coach. You will be given a video
of someone speaking, along with its transcript. Watch the video and read the transcript, then assess:

- Tone: how the speaker comes across emotionally (confident, hesitant, energetic, etc.)
- Delivery: pacing, clarity, filler-word usage, vocal variety
- Visual presence: eye contact with the camera, posture, framing, facial expression, gestures
- Content: structure (clear intro/body/conclusion), language quality (grammar, vocabulary, clarity),
  and overall messaging (is the key point clear, is it persuasive, is there a strong takeaway)

Score each from 0-100. Be specific — reference actual moments, phrases, or visual details rather
than generic advice. Respond only with the structured JSON described by the schema.`;

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
 * Sends the uploaded video plus its transcript to Gemini and returns
 * structured tone/delivery/visual/content scores and feedback.
 */
async function analyzeVideoWithGemini({ videoBuffer, mimeType, fileName, transcript, durationSeconds }) {
  const uploaded = await uploadVideo(videoBuffer, mimeType, fileName);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: FEEDBACK_SCHEMA
    },
    systemInstruction: SYSTEM_PROMPT
  });

  const transcriptNote = transcript
    ? `Transcript:\n"""\n${transcript}\n"""${durationSeconds ? `\n\nDuration: ${Math.round(durationSeconds)} seconds` : ""}`
    : "No transcript was available — base your assessment on the video alone.";

  const result = await model.generateContent([
    { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
    { text: transcriptNote }
  ]);

  await fileManager.deleteFile(uploaded.name).catch(() => {});

  return JSON.parse(result.response.text());
}

module.exports = { analyzeVideoWithGemini };
