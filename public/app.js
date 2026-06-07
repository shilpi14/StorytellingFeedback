// Keep this in sync with MAX_UPLOAD_BYTES in server.js — catching an oversized
// file client-side avoids a long, doomed upload over a slow mobile connection.
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB

const heroEl = document.getElementById("hero");
const speakerNameInput = document.getElementById("speaker-name");
const speakerContextInput = document.getElementById("speaker-context");
const videoInput = document.getElementById("video-input");
const fileNameLabel = document.getElementById("file-name");
const analyzeBtn = document.getElementById("analyze-btn");
const uploadLabel = document.getElementById("upload-label");
const videoPreview = document.getElementById("video-preview");

const uploadSection = document.getElementById("upload-section");
const statusSection = document.getElementById("status-section");
const resultSection = document.getElementById("result-section");
const errorSection = document.getElementById("error-section");

const overallScoreEl = document.getElementById("overall-score");
const sectionListEl = document.getElementById("section-list");
const downloadLink = document.getElementById("download-link");
const errorText = document.getElementById("error-text");

const resetBtn = document.getElementById("reset-btn");
const errorResetBtn = document.getElementById("error-reset-btn");

const fileSizeWarning = document.getElementById("file-size-warning");
const statusText = document.getElementById("status-text");

let selectedFile = null;
let previewUrl = null;

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

function showOnly(section) {
  [uploadSection, statusSection, resultSection, errorSection].forEach((s) => {
    s.classList.toggle("hidden", s !== section);
  });
  // The results screen is long enough on its own — skip the hero title there
  // and let it open straight into the score and feedback.
  if (heroEl) heroEl.classList.toggle("hidden", section === resultSection);
}

videoInput.addEventListener("change", () => {
  selectedFile = videoInput.files[0] || null;

  fileSizeWarning.classList.add("hidden");
  fileSizeWarning.textContent = "";

  if (selectedFile && selectedFile.size > MAX_UPLOAD_BYTES) {
    fileSizeWarning.textContent =
      `That file is about ${formatMb(selectedFile.size)}MB — larger than our ${formatMb(MAX_UPLOAD_BYTES)}MB limit. ` +
      `Please trim it to a shorter clip (a focused 1-3 minute story works best) and choose it again.`;
    fileSizeWarning.classList.remove("hidden");
    selectedFile = null;
    videoInput.value = "";
  }

  analyzeBtn.disabled = !selectedFile;

  videoPreview.pause();
  videoPreview.removeAttribute("src");
  videoPreview.load();

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (selectedFile) {
    previewUrl = URL.createObjectURL(selectedFile);
    videoPreview.src = previewUrl;
    videoPreview.load();
    videoPreview.classList.remove("hidden");
    uploadLabel.classList.add("compact");
    fileNameLabel.textContent = selectedFile.name;
  } else {
    videoPreview.removeAttribute("src");
    videoPreview.classList.add("hidden");
    uploadLabel.classList.remove("compact");
    fileNameLabel.textContent = "Choose a video";
  }
});

// fetch() has no upload-progress hooks, so we use XMLHttpRequest directly —
// large video uploads can take a while on mobile connections, and without this
// the spinner just sits there looking frozen (the exact bug the user hit).
function uploadAndAnalyze(file, speakerName, context) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("video", file);
    formData.append("speakerName", speakerName);
    formData.append("context", context);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      if (statusText) {
        statusText.textContent = pct < 100 ? `Uploading your video… ${pct}%` : "Upload complete — analyzing your story…";
      }
    });

    xhr.addEventListener("load", () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch (parseErr) {
        // fall through with empty data; status check below will produce a generic error
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.error || "Something went wrong while analyzing the video."));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("We lost the connection while uploading. Please check your network and try again."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("The upload timed out. Please try a shorter clip or a stronger connection."));
    });

    xhr.open("POST", "/api/analyze");
    xhr.timeout = 10 * 60 * 1000; // 10 minutes — generous for large clips on slow connections
    xhr.send(formData);
  });
}

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  showOnly(statusSection);
  if (statusText) statusText.textContent = "Uploading your video… 0%";

  try {
    const data = await uploadAndAnalyze(
      selectedFile,
      speakerNameInput.value.trim(),
      speakerContextInput.value.trim()
    );
    renderResult(data.id, data.feedback);
  } catch (err) {
    errorText.textContent = err.message;
    showOnly(errorSection);
  } finally {
    if (statusText) statusText.textContent = "Analyzing…";
  }
});

function toTen(scoreOutOf100) {
  return (scoreOutOf100 / 10).toFixed(1);
}

function badgeClass(scoreOutOf10) {
  const value = parseFloat(scoreOutOf10);
  if (value >= 8) return "good";
  if (value >= 6) return "ok";
  return "low";
}

function renderResult(id, feedback) {
  const overall = toTen(feedback.overallScore);
  overallScoreEl.textContent = `${overall}/10`;
  document.getElementById("score-ring").style.setProperty("--pct", feedback.overallScore);

  sectionListEl.innerHTML = "";
  feedback.sections.forEach((section) => {
    const score = toTen(section.score);
    const li = document.createElement("li");
    li.innerHTML = `<span>${section.title}</span><span class="badge ${badgeClass(score)}">${score}</span>`;
    sectionListEl.appendChild(li);
  });

  downloadLink.href = `/api/report/${id}/pdf`;
  showOnly(resultSection);
}

function reset() {
  selectedFile = null;
  videoInput.value = "";
  fileNameLabel.textContent = "Choose a video";
  analyzeBtn.disabled = true;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  videoPreview.removeAttribute("src");
  videoPreview.classList.add("hidden");
  uploadLabel.classList.remove("compact");

  showOnly(uploadSection);
}

resetBtn.addEventListener("click", reset);
errorResetBtn.addEventListener("click", reset);
