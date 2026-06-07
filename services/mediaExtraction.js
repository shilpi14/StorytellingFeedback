const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);

function tempPath(extension) {
  return path.join(os.tmpdir(), `${crypto.randomUUID()}.${extension}`);
}

function cleanup(...files) {
  files.forEach((file) => {
    try {
      fs.unlinkSync(file);
    } catch {
      // best-effort cleanup
    }
  });
}

/**
 * Writes the uploaded video buffer to a temp file, extracts its audio track
 * as an M4A file, and returns the audio buffer (used for Deepgram transcription —
 * Gemini handles visual/content analysis directly from the video itself).
 */
async function extractAudio(videoBuffer) {
  const videoFile = tempPath("mp4");
  const audioFile = tempPath("m4a");
  fs.writeFileSync(videoFile, videoBuffer);

  await new Promise((resolve, reject) => {
    ffmpeg(videoFile)
      .noVideo()
      .audioCodec("aac")
      .format("ipod")
      .on("end", resolve)
      .on("error", reject)
      .save(audioFile);
  });

  const audioBuffer = fs.readFileSync(audioFile);
  cleanup(videoFile, audioFile);
  return audioBuffer;
}

module.exports = { extractAudio };
