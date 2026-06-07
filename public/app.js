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

let selectedFile = null;
let previewUrl = null;

function showOnly(section) {
  [uploadSection, statusSection, resultSection, errorSection].forEach((s) => {
    s.classList.toggle("hidden", s !== section);
  });
}

videoInput.addEventListener("change", () => {
  selectedFile = videoInput.files[0] || null;
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

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  showOnly(statusSection);

  const formData = new FormData();
  formData.append("video", selectedFile);
  formData.append("speakerName", speakerNameInput.value.trim());
  formData.append("context", speakerContextInput.value.trim());

  try {
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong while analyzing the video.");
    }

    renderResult(data.id, data.feedback);
  } catch (err) {
    errorText.textContent = err.message;
    showOnly(errorSection);
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
