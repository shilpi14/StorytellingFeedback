const { createClient } = require("@deepgram/sdk");

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

/**
 * Transcribes audio with Deepgram, returning the transcript text plus
 * word-level timing data (used to derive pace and filler-word stats).
 */
async function transcribeAudio(audioBuffer, mimeType = "audio/mp4") {
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
    model: "nova-2",
    smart_format: true,
    punctuate: true,
    filler_words: true,
    mimetype: mimeType
  });

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message || error}`);
  }

  const channel = result?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  return {
    transcript: alternative?.transcript || "",
    words: alternative?.words || [],
    durationSeconds: result?.metadata?.duration || 0
  };
}

module.exports = { transcribeAudio };
