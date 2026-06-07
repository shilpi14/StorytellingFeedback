const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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

function probeDuration(videoFile) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoFile, (err, data) => {
      if (err || !data || !data.format || !data.format.duration) return resolve(0);
      resolve(data.format.duration);
    });
  });
}

function grabFrameAt(videoFile, timestampSeconds) {
  const framePath = tempPath("jpg");
  return new Promise((resolve, reject) => {
    ffmpeg(videoFile)
      .seekInput(timestampSeconds)
      .frames(1)
      .output(framePath)
      .on("end", () => {
        try {
          const buffer = fs.readFileSync(framePath);
          cleanup(framePath);
          resolve(buffer);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject)
      .run();
  });
}

/**
 * Grabs a handful of representative frame images (as JPEG buffers) spread across
 * the video's runtime — used to give the PDF report real visual snapshots from
 * the speaker's own video rather than generic stock imagery.
 */
async function extractFrames(videoBuffer, count = 4) {
  const videoFile = tempPath("mp4");
  fs.writeFileSync(videoFile, videoBuffer);

  try {
    const duration = await probeDuration(videoFile);
    if (!duration || duration < 1) return [];

    // Spread across the middle of the video, avoiding the very first/last instants.
    const fractions = [0.12, 0.38, 0.64, 0.88].slice(0, count);
    const timestamps = fractions.map((fraction) =>
      Math.min(Math.max(duration * fraction, 0.5), duration - 0.25)
    );

    const frames = [];
    for (const timestamp of timestamps) {
      try {
        const image = await grabFrameAt(videoFile, timestamp);
        frames.push({ timestamp, image });
      } catch {
        // Skip frames that fail to extract rather than failing the whole report.
      }
    }
    return frames;
  } finally {
    cleanup(videoFile);
  }
}

module.exports = { extractAudio, extractFrames };
