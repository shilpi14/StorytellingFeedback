const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager, FileState } = require("@google/generative-ai/server");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const FEEDBACK_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    speech: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description:
            "1-2 sentences assessing clarity of speech and voice modulation — articulation, pacing, " +
            "filler words, vocal energy, tone, and how well the voice's pitch/volume/emphasis varied " +
            "to keep the listener engaged."
        }
      },
      required: ["score", "summary"]
    },
    bodyLanguage: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description:
            "1-2 sentences assessing body language and facial expression — eye contact with the " +
            "camera, posture, framing, facial expressiveness, and use of gestures."
        }
      },
      required: ["score", "summary"]
    },
    contentStructure: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER, description: "0-100" },
        summary: {
          type: SchemaType.STRING,
          description:
            "1-2 sentences assessing content structure — quality of the opening (does it hook the " +
            "audience), impact of the closing, coherence and logical flow of ideas, persuasion through " +
            "emotional appeal/logic/credibility (ethos/pathos/logos), and general language quality."
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
  required: ["speech", "bodyLanguage", "contentStructure", "strengths", "improvements"]
};

const SYSTEM_PROMPT = `You are an expert communication and presentation coach. You will be given a video
of someone speaking, along with its transcript. Watch the video and read the transcript, then assess
the speaker across exactly three categories:

- Clarity of speech and voice modulation: articulation, pacing, filler-word usage, vocal energy,
  emotional tone, and how well pitch/volume/emphasis varied to keep the listener engaged
- Body language and facial expression: eye contact with the camera, posture, framing,
  facial expressiveness, and use of gestures
- Content structure: a strong opening that hooks the audience, an impactful closing, coherence and
  logical flow of ideas, and persuasion through emotional appeal, logic, and credibility — plus
  general language quality (grammar, vocabulary, clarity)

Score each from 0-100, with a short 1-2 sentence summary per category. Separately, also provide:
- strengths: exactly 3 specific things the speaker did well, citing moments from the video or transcript
- improvements: exactly 3 specific, actionable suggestions for improvement

Be specific — reference actual moments, phrases, or visual details rather than generic advice.
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
