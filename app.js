/* PassGrid — client-side only. Nothing here ever leaves the browser. */

const PRESETS = [
  { id: "india",    name: "India",           w: 35,   h: 45   },
  { id: "us",       name: "United States",   w: 50.8, h: 50.8 },
  { id: "uk",       name: "United Kingdom",  w: 35,   h: 45   },
  { id: "schengen", name: "Schengen / EU",   w: 35,   h: 45   },
  { id: "china",    name: "China",           w: 33,   h: 48   },
  { id: "canada",   name: "Canada",          w: 50,   h: 70   },
  { id: "australia",name: "Australia",       w: 35,   h: 45   },
  { id: "japan",    name: "Japan",           w: 35,   h: 45   },
];

const MM_TO_PX_AT_300DPI = mm => Math.round((mm / 25.4) * 300);

const state = {
  image: null,          // original HTMLImageElement
  faceBox: null,        // {x,y,width,height} in original image px, or null
  selectedPreset: PRESETS[0],
  paper: { w: 210, h: 297 },
  marginMM: 10,
  gapMM: 2,
  enhance: false,
  croppedCanvas: null,  // final cropped single-photo canvas (high-res)
};

const el = id => document.getElementById(id);

/* ---------------------------------------------------------- upload ---- */

const dropzone = el("dropzone");
const fileInput = el("file-input");
const previewCanvas = el("preview-canvas");
const dropzoneInner = el("dropzone-inner");
const uploadActions = el("upload-actions");
const detectStatus = el("detect-status");

dropzone.addEventListener("click", () => {
  if (!state.image) fileInput.click();
});
el("btn-change-photo").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener("change", e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
["dragover", "dragenter"].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach(evt =>
  dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove("dragover"); })
);
dropzone.addEventListener("drop", e => {
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    setStatus("That file doesn't look like an image. Try a JPEG or PNG.", "warn");
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = async () => {
      state.image = img;
      dropzoneInner.hidden = true;
      previewCanvas.hidden = false;
      uploadActions.hidden = false;
      drawFit(previewCanvas, img);
      setStatus("Looking for a face…", "");
      await detectFace(img);
      rebuildOutput();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function drawFit(canvas, img) {
  const maxW = 620, maxH = 340;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function setStatus(msg, kind) {
  detectStatus.textContent = msg;
  detectStatus.className = "status-line" + (kind ? " " + kind : "");
}

/* ------------------------------------------------------ face detect --- */

let modelsLoaded = false;
async function loadModels() {
  if (modelsLoaded) return;
  const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

async function detectFace(img) {
  try {
    await loadModels();
    const detection = await faceapi.detectSingleFace(
      img,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );
    if (detection) {
      state.faceBox = detection.box;
      setStatus("Face detected — the photo will be centered automatically.", "ok");
    } else {
      state.faceBox = null;
      setStatus("No face detected. Falling back to a centered crop — adjust the source photo if this looks off.", "warn");
    }
  } catch (err) {
    console.error(err);
    state.faceBox = null;
    setStatus("Face detection could not run (offline or blocked). Using a centered crop instead.", "warn");
  }
}

/* --------------------------------------------------------- presets ---- */

const presetGrid = el("preset-grid");
function renderPresets() {
  presetGrid.innerHTML = "";
  PRESETS.forEach(p => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "preset-card" + (p === state.selectedPreset ? " selected" : "");
    card.innerHTML = `<p class="preset-name">${p.name}</p><p class="preset-dims">${p.w} × ${p.h} mm</p>`;
    card.addEventListener("click", () => {
      state.selectedPreset = p;
      renderPresets();
      rebuildOutput();
    });
    presetGrid.appendChild(card);
  });
}
renderPresets();

el("btn-apply-custom").addEventListener("click", () => {
  const w = parseFloat(el("custom-w").value);
  const h = parseFloat(el("custom-h").value);
  if (w > 0 && h > 0) {
    state.selectedPreset = { id: "custom", name: "Custom", w, h };
    renderPresets();
    rebuildOutput();
  }
});

/* ------------------------------------------------------------ paper ---- */

const paperSelect = el("paper-select");
const marginSelect = el("margin-select");
const gapSelect = el("gap-select");
const paperCustomStatus = el("paper-custom-status");

paperSelect.addEventListener("change", () => {
  const opt = paperSelect.selectedOptions[0];
  state.paper = { w: parseFloat(opt.dataset.w), h: parseFloat(opt.dataset.h) };
  rebuildOutput();
});
state.paper = { w: 210, h: 297 };

marginSelect.addEventListener("change", e => {
  state.marginMM = parseFloat(e.target.value);
  rebuildOutput();
});
gapSelect.addEventListener("change", e => {
  state.gapMM = parseFloat(e.target.value);
  rebuildOutput();
});
el("btn-apply-paper-custom").addEventListener("click", () => {
  const w = parseFloat(el("custom-paper-w").value);
  const h = parseFloat(el("custom-paper-h").value);
  const margin = parseFloat(el("custom-margin").value);
  const gap = parseFloat(el("custom-gap").value);
  if (![w, h, margin, gap].every(Number.isFinite) || w < 20 || h < 20 || margin < 0 || gap < 0) {
    paperCustomStatus.textContent = "Enter valid dimensions. Paper must be at least 20 mm on each side; margin and spacing cannot be negative.";
    paperCustomStatus.className = "field-message warn";
    return;
  }
  if (margin * 2 >= w || margin * 2 >= h) {
    paperCustomStatus.textContent = "The margin is too large for this paper size.";
    paperCustomStatus.className = "field-message warn";
    return;
  }
  state.paper = { w, h };
  state.marginMM = margin;
  state.gapMM = gap;
  paperSelect.value = "custom";
  marginSelect.value = "custom";
  gapSelect.value = "custom";
  paperCustomStatus.textContent = `Using ${w} × ${h} mm paper with ${margin} mm margins and ${gap} mm spacing.`;
  paperCustomStatus.className = "field-message ok";
  rebuildOutput();
});
el("toggle-guides").addEventListener("change", rebuildOutput);
el("toggle-enhance").addEventListener("change", e => {
  state.enhance = e.target.checked;
  rebuildOutput();
});

/* ------------------------------------------------------------- crop ---- */

// Crop the source image to the target aspect ratio, centered on the detected
// face using the common passport-photo rule of thumb (face height roughly
// 55-60% of the frame height, eyes around 55% down from the top of the crop).
function computeCropRect(img, targetW, targetH) {
  const targetRatio = targetW / targetH;
  const imgRatio = img.width / img.height;

  if (state.faceBox) {
    const fb = state.faceBox;
    const faceCenterX = fb.x + fb.width / 2;
    const faceCenterY = fb.y + fb.height / 2;
    // Aim for the face height to be ~50% of the crop height.
    const desiredCropH = fb.height / 0.5;
    let cropH = Math.min(desiredCropH, img.height);
    let cropW = cropH * targetRatio;
    if (cropW > img.width) {
      cropW = img.width;
      cropH = cropW / targetRatio;
    }
    // Position: face center at ~42% down from top of the crop.
    let x = faceCenterX - cropW / 2;
    let y = faceCenterY - cropH * 0.42;
    x = Math.max(0, Math.min(x, img.width - cropW));
    y = Math.max(0, Math.min(y, img.height - cropH));
    return { x, y, w: cropW, h: cropH };
  }

  // No face: centered crop matching the aspect ratio.
  let cropW, cropH;
  if (imgRatio > targetRatio) {
    cropH = img.height;
    cropW = cropH * targetRatio;
  } else {
    cropW = img.width;
    cropH = cropW / targetRatio;
  }
  return { x: (img.width - cropW) / 2, y: (img.height - cropH) / 2, w: cropW, h: cropH };
}

function buildCroppedCanvas() {
  if (!state.image) return null;
  const preset = state.selectedPreset;
  const outW = MM_TO_PX_AT_300DPI(preset.w);
  const outH = MM_TO_PX_AT_300DPI(preset.h);
  const rect = computeCropRect(state.image, outW, outH);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(state.image, rect.x, rect.y, rect.w, rect.h, 0, 0, outW, outH);

  if (state.enhance) applyEnhancement(ctx, outW, outH);

  return canvas;
}

// Simple, non-destructive-looking enhancement: mild contrast/brightness lift
// plus a light unsharp-mask style sharpen pass.
function applyEnhancement(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const contrast = 1.08, brightness = 6;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = d[i + c];
      v = (v - 128) * contrast + 128 + brightness;
      d[i + c] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  sharpen(ctx, w, h, 0.25);
}

function sharpen(ctx, w, h, amount) {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const sData = src.data, dData = dst.data;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        dData[idx] = sData[idx]; dData[idx+1] = sData[idx+1]; dData[idx+2] = sData[idx+2]; dData[idx+3] = sData[idx+3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0, k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nIdx = ((y + ky) * w + (x + kx)) * 4 + c;
            sum += sData[nIdx] * kernel[k++];
          }
        }
        const orig = sData[idx + c];
        const sharpened = orig + (sum - orig) * amount;
        dData[idx + c] = Math.max(0, Math.min(255, sharpened));
      }
      dData[idx + 3] = sData[idx + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/* --------------------------------------------------------- grid math -- */

function computeGrid() {
  const preset = state.selectedPreset;
  const usableW = state.paper.w - 2 * state.marginMM;
  const usableH = state.paper.h - 2 * state.marginMM;
  const cols = Math.max(0, Math.floor((usableW + state.gapMM) / (preset.w + state.gapMM)));
  const rows = Math.max(0, Math.floor((usableH + state.gapMM) / (preset.h + state.gapMM)));
  return { cols, rows, count: cols * rows };
}

/* -------------------------------------------------------- rendering --- */

const outputCanvas = el("output-canvas");
const outputEmpty = el("output-empty");
const gridSummary = el("grid-summary");
const downloadPdfButton = el("btn-download-pdf");
const downloadJpegButton = el("btn-download-jpeg");

function rebuildOutput() {
  if (!state.image) return;
  state.croppedCanvas = buildCroppedCanvas();
  outputEmpty.hidden = true;
  outputCanvas.hidden = false;
  const grid = computeGrid();
  const hasRoom = grid.count > 0;
  downloadPdfButton.disabled = !hasRoom;
  downloadJpegButton.disabled = false;
  gridSummary.textContent = hasRoom
    ? `${grid.cols} × ${grid.rows} = ${grid.count} photo${grid.count === 1 ? "" : "s"} per ${paperLabel()} sheet.`
    : "This photo does not fit within the selected paper and margins. Choose larger paper or smaller margins.";
  gridSummary.className = "grid-summary" + (hasRoom ? "" : " warn");
  drawOutputPreview(grid);
}

function paperLabel() {
  return paperSelect.value === "custom"
    ? `${state.paper.w} × ${state.paper.h} mm`
    : paperSelect.selectedOptions[0].textContent;
}

function drawOutputPreview(grid) {
  const previewScale = 2.5; // px per mm, for on-screen preview only
  const canvas = outputCanvas;
  canvas.width = state.paper.w * previewScale;
  canvas.height = state.paper.h * previewScale;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!state.croppedCanvas) return;

  const preset = state.selectedPreset;
  const cellW = preset.w * previewScale;
  const cellH = preset.h * previewScale;
  const gap = state.gapMM * previewScale;
  const margin = state.marginMM * previewScale;
  const showGuides = el("toggle-guides").checked;

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = margin + c * (cellW + gap);
      const y = margin + r * (cellH + gap);
      ctx.drawImage(state.croppedCanvas, x, y, cellW, cellH);
      if (showGuides) {
        ctx.strokeStyle = "#9aa3af";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      }
    }
  }
}

/* --------------------------------------------------------- exports ----- */

downloadPdfButton.addEventListener("click", () => {
  if (!state.croppedCanvas) return;
  const { jsPDF } = window.jspdf;
  const grid = computeGrid();
  const orientation = state.paper.w > state.paper.h ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "mm", format: [state.paper.w, state.paper.h], orientation });

  const preset = state.selectedPreset;
  const gap = state.gapMM;
  const margin = state.marginMM;
  const imgData = state.croppedCanvas.toDataURL("image/jpeg", 0.95);
  const showGuides = el("toggle-guides").checked;

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = margin + c * (preset.w + gap);
      const y = margin + r * (preset.h + gap);
      doc.addImage(imgData, "JPEG", x, y, preset.w, preset.h);
      if (showGuides) {
        doc.setDrawColor(160, 160, 160);
        doc.setLineWidth(0.1);
        doc.rect(x, y, preset.w, preset.h);
      }
    }
  }
  doc.save(`passgrid-${preset.id}-${state.paper.w}x${state.paper.h}mm.pdf`);
});

downloadJpegButton.addEventListener("click", () => {
  if (!state.croppedCanvas) return;
  const link = document.createElement("a");
  link.download = `passgrid-${state.selectedPreset.id}-photo.jpg`;
  link.href = state.croppedCanvas.toDataURL("image/jpeg", 0.97);
  link.click();
});
