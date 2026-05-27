const views = Array.from(document.querySelectorAll(".view"));
const progressItems = Array.from(document.querySelectorAll(".stepbar span"));
const camera = document.querySelector("#camera");
const preview = document.querySelector("#preview");
const mediaBox = document.querySelector(".media-box");
const captureBtn = document.querySelector("#captureBtn");
const uploadBtn = document.querySelector("#uploadBtn");
const runBtn = document.querySelector("#runBtn");
const clearCanvasBtn = document.querySelector("#clearCanvasBtn");
const useDrawingBtn = document.querySelector("#useDrawingBtn");
const modeCameraBtn = document.querySelector("#modeCameraBtn");
const modeDrawBtn = document.querySelector("#modeDrawBtn");
const drawCanvas = document.querySelector("#drawCanvas");
const colorSwatches = document.querySelector("#colorSwatches");
const shapeTools = document.querySelector("#shapeTools");
const fileInput = document.querySelector("#fileInput");
const statusText = document.querySelector("#statusText");
const stageGrid = document.querySelector("#stageGrid");
const errorPanel = document.querySelector("#errorPanel");
const resultGallery = document.querySelector("#resultGallery");
const reportTitle = document.querySelector("#reportTitle");
const reportSubtitle = document.querySelector("#reportSubtitle");
const matchPercent = document.querySelector("#matchPercent");
const mbtiCode = document.querySelector("#mbtiCode");
const mbtiName = document.querySelector("#mbtiName");
const reportThesis = document.querySelector("#reportThesis");
const dimensionList = document.querySelector("#dimensionList");
const artistMatchList = document.querySelector("#artistMatchList");
const reportNarrative = document.querySelector("#reportNarrative");
const reportQuote = document.querySelector("#reportQuote");
const reportClosing = document.querySelector("#reportClosing");

const viewOrder = ["start", "learn", "input", "process", "result"];
const stageMeta = [
  { key: "observation", title: "观察素描", note: "识别出的可能真实对象" },
  { key: "analysis", title: "结构分析", note: "把对象拆成线、轴线和空间关系" },
  { key: "simplification", title: "几何简化", note: "把对象压缩成几何体块和平面" },
  { key: "abstraction", title: "风格派终稿", note: "接近用户输入的最终抽象构成" },
];

let stream = null;
let selectedImage = "";
let inputMode = "camera";
let analysisResult = null;
let reportResult = null;
let generatedStages = [];
let drawing = false;
let brushColor = "#111417";
let activeShape = "rect";
let dragStart = null;
let dragSnapshot = null;

function setStatus(text) {
  statusText.textContent = text;
}

function setError(message) {
  if (!errorPanel) return;
  errorPanel.hidden = !message;
  errorPanel.textContent = message || "";
}

function setView(name) {
  const index = viewOrder.indexOf(name);
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === name));
  progressItems.forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
  if (name === "input" && inputMode === "camera") startCamera();
  if (name === "process") renderStages();
  if (name === "result") renderResult();
}

function setInputMode(mode) {
  inputMode = mode;
  document.querySelectorAll(".input-mode").forEach((el) => {
    el.classList.toggle("active", el.dataset.inputMode === mode);
  });
  modeCameraBtn.classList.toggle("active", mode === "camera");
  modeDrawBtn.classList.toggle("active", mode === "draw");
  document.body.classList.toggle("draw-active", mode === "draw");
  setStatus(mode === "draw" ? "在 4:3 横向画布上拖拽生成实心图形，然后点击“使用画作”。" : "摄像头模式：拍摄或上传一张 4:3 横向作品。");
  if (mode === "camera") startCamera();
}

async function startCamera() {
  if (stream || !navigator.mediaDevices?.getUserMedia) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1024 },
        height: { ideal: 768 },
        aspectRatio: { ideal: 1.333333 },
        facingMode: "environment",
      },
      audio: false,
    });
    camera.srcObject = stream;
  } catch {
    setStatus("摄像头不可用，请上传照片或切换到作画。");
  }
}

function setSelectedImage(dataUrl) {
  selectedImage = dataUrl;
  preview.src = dataUrl;
  mediaBox.classList.add("has-image");
  setStatus("图片已准备好，可以开始生成。");
}

function imageToFourThreeDataUrl(source, width = 1024, height = 768) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetRatio = width / height;
      const sourceRatio = img.naturalWidth / img.naturalHeight;
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (sourceRatio > targetRatio) {
        sw = img.naturalHeight * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / targetRatio;
        sy = (img.naturalHeight - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#f7fbfd";
      context.fillRect(0, 0, width, height);
      context.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = source;
  });
}

function fallbackSvg(variant) {
  const colors = [
    ["#f7fbfd", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
    ["#edf5f8", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
    ["#dfeaf0", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
    ["#f7fbfd", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
  ][variant] || ["#f7fbfd", "#111417", "#ef2c2f", "#0877c9", "#f0c929"];
  const [bg, ink, red, blue, yellow] = colors;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
      <rect width="1024" height="768" fill="${bg}"/>
      <rect x="118" y="94" width="52" height="548" fill="${ink}"/>
      <rect x="118" y="284" width="784" height="46" fill="${ink}"/>
      <rect x="420" y="94" width="32" height="548" fill="${ink}"/>
      <rect x="520" y="138" width="258" height="186" fill="${blue}"/>
      <rect x="196" y="410" width="190" height="132" fill="${red}"/>
      <rect x="742" y="548" width="162" height="116" fill="${yellow}"/>
    </svg>
  `)}`;
}

function stageCards() {
  if (generatedStages.length) return generatedStages;
  const original = selectedImage ? [{ title: "用户作品", note: "输入的最终抽象图", imageBase64: selectedImage, pending: false }] : [];
  return [
    ...original,
    ...stageMeta.slice(original.length).map((meta, index) => ({
      title: meta.title,
      note: "等待四宫格生成",
      imageBase64: fallbackSvg(index),
      pending: true,
    })),
  ];
}

function renderStages() {
  stageGrid.innerHTML = stageCards()
    .map(
      (item, index) => `
        <article class="stage-card ${item.pending ? "is-pending" : ""}">
          <div class="stage-image"><img src="${item.imageBase64}" alt="${item.title}"></div>
          <div class="stage-caption">
            <h3>${index + 1}. ${item.title}</h3>
            <p>${item.note}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderResultGallery() {
  const captions = reportResult?.stageCaptions || {};
  const captionsByIndex = [captions.original, captions.stage2, captions.stage1, captions.realistic || captions.stage3];
  resultGallery.innerHTML = stageCards()
    .map(
      (item, index) => `
        <article class="result-image-card">
          <img src="${item.imageBase64}" alt="${item.title}">
          <div>
            <b>${String(index + 1).padStart(2, "0")}</b>
            <h3>${item.title}</h3>
            <p>${captionsByIndex[index] || item.note}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderReportText() {
  const words = Array.isArray(analysisResult?.semanticWords) ? analysisResult.semanticWords.join(" / ") : "";
  const persona = reportResult?.persona || reportResult?.primaryArtist?.name || "";
  const score = reportResult?.match_score || reportResult?.matchPercent || 0;

  reportTitle.textContent = reportResult?.title || (persona ? `你是${persona}` : "生成报告");
  reportSubtitle.textContent = reportResult?.subtitle || words || "报告会在生成完成后自动补充；你可以先查看已有画作。";
  matchPercent.textContent = score ? `${score}%` : "--";
  mbtiCode.textContent = reportResult?.mbti?.code || "STIJL";
  mbtiName.textContent = reportResult?.mbti?.name || persona || "艺术家人格生成中";
  reportThesis.textContent =
    reportResult?.mbti?.summary ||
    reportResult?.why?.join(" ") ||
    reportResult?.primaryArtist?.reason ||
    analysisResult?.semanticSentence ||
    "系统会根据作品结构、色块、倒推线索和生成链路写出分析。";

  const dimensions = reportResult?.dimensions || [
    { label: "形式", value: 0 },
    { label: "转译", value: 0 },
    { label: "倒推", value: 0 },
    { label: "互动", value: 0 },
    { label: "留存", value: 0 },
  ];
  dimensionList.innerHTML = dimensions
    .map(
      (item) => `
        <div class="dimension-row">
          <span>${item.label}</span>
          <i><em style="width:${Math.max(0, Math.min(100, Number(item.value) || 0))}%"></em></i>
          <b>${item.value || 0}</b>
        </div>
      `,
    )
    .join("");

  const matches = reportResult?.artistMatches || [
    { name: "蒙德里安", score: 0, trait: "秩序平衡", note: "等待匹配。" },
    { name: "杜斯伯格", score: 0, trait: "动态突破", note: "等待匹配。" },
    { name: "里特维德", score: 0, trait: "空间建构", note: "等待匹配。" },
    { name: "范德莱克", score: 0, trait: "色面叙事", note: "等待匹配。" },
    { name: "范通格洛", score: 0, trait: "比例理性", note: "等待匹配。" },
  ];
  artistMatchList.innerHTML = matches
    .map(
      (item) => `
        <article>
          <div>
            <b>${item.score || 0}%</b>
            <h4>${item.name}</h4>
            <span>${item.trait || ""}</span>
          </div>
          <p>${item.note || ""}</p>
        </article>
      `,
    )
    .join("");

  const comment = reportResult?.work_comment;
  reportNarrative.textContent =
    reportResult?.narrative ||
    (comment ? `结构：${comment.structure} 色彩：${comment.color} 抽象：${comment.abstraction} 倒推潜力：${comment.reverse_potential}` : "");
  reportQuote.textContent = reportResult?.quote ? `“${reportResult.quote}”` : "";
  reportClosing.textContent = reportResult?.closing || reportResult?.next_interaction || "";
}

function renderResult() {
  renderResultGallery();
  renderReportText();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = data.error || data.message || data.raw || "请求失败";
    throw new Error(`[${response.status}] ${url}\n${detail}`);
  }
  return data;
}

function buildQuadPrompt(analysis) {
  const sourceTypes = (analysis?.candidate_source_types || [])
    .map((item) => `${item.type || item.candidate || "unknown"} ${item.reason || ""}`)
    .join("; ");
  const clues = (analysis?.reverse_clues || [])
    .map((item) => `${item.visual_clue || ""} -> ${item.possible_meaning || ""}`)
    .join("; ");
  const palette = analysis?.formal_features?.color_palette?.join(", ") || "red, yellow, blue, black, white, gray";
  const sentence = analysis?.semanticSentence || analysis?.shortComment || "a possible real object translated into De Stijl abstraction";

  return `
Create one single coherent 2x2 museum worksheet image showing the reverse process of an artist transforming a real object into a De Stijl abstraction.

The user's uploaded image is the final abstract artwork. A vision model inferred these clues:
- Possible source direction: ${sourceTypes || "unknown, infer a plausible object from composition"}
- Visual clues: ${clues || "use block position, weight, supports, voids and direction"}
- Palette and formal language: ${palette}
- Summary: ${sentence}

Generate four panels in a strict 2 by 2 grid with thin neutral dividers and no text:
Top left panel: realistic observation sketch of the inferred real object or scene, pencil drawing, recognizable, no abstraction.
Top right panel: analytical construction drawing of the same object, showing geometric axes, vertical supports, horizontal planes, structural guide lines, subtle red/black analysis lines.
Bottom left panel: simplified geometric masses of the same object, muted blocks, reduced volume, early abstraction, still object-like.
Bottom right panel: final De Stijl abstraction corresponding to the uploaded artwork, primary colors and neutrals, black vertical and horizontal bars, asymmetrical balance, matching the user's composition logic.

The four panels must depict the same subject and the same composition evolving step by step. Do not create four unrelated images.
Absolutely no words, no labels, no numbers, no captions, no signatures, no watermark, no UI.
`;
}

function cropQuadrants(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const crops = [
        [0, 0],
        [img.naturalWidth / 2, 0],
        [0, img.naturalHeight / 2],
        [img.naturalWidth / 2, img.naturalHeight / 2],
      ];
      const width = img.naturalWidth / 2;
      const height = img.naturalHeight / 2;
      resolve(
        crops.map(([sx, sy]) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1024;
          canvas.height = 768;
          const context = canvas.getContext("2d");
          context.fillStyle = "#f7fbfd";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, sx, sy, width, height, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/png");
        }),
      );
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function generateQuadOnce() {
  generatedStages = [];
  reportResult = null;
  setError("");
  renderStages();
  setStatus("正在理解终稿，并生成四宫格推演图...");

  const result = await postJson("/api/generate-stage", {
    mode: "quad",
    title: "风格派倒推四宫格",
    prompt: buildQuadPrompt(analysisResult),
  });
  const quadrants = await cropQuadrants(result.imageBase64);
  generatedStages = quadrants.map((imageBase64, index) => ({
    ...stageMeta[index],
    imageBase64,
    pending: false,
  }));
  renderStages();
  renderResult();

  setStatus("四宫格已生成，正在撰写作品分析报告。");
  reportResult = await postJson("/api/report", {
    analysis: analysisResult,
    stages: generatedStages.map(({ title, note }) => ({ title, note })),
  });
  setView("result");
  renderResult();
  setStatus("四宫格与报告已生成完成。");
}

async function runApi() {
  if (!selectedImage) {
    setStatus(inputMode === "draw" ? "请先点击“使用画作”。" : "请先拍摄或上传一张图片。");
    return;
  }

  runBtn.disabled = true;
  setError("");
  setStatus("正在提取风格派形式特征...");

  try {
    generatedStages = [];
    reportResult = null;
    setView("process");
    renderStages();
    analysisResult = await postJson("/api/analyze", { imageBase64: selectedImage });
    await generateQuadOnce();
  } catch (error) {
    const message = error instanceof Error ? error.message : "API 调用失败。";
    setStatus(message.split("\n")[0]);
    setError(`生成失败\n\n${message}\n\n请检查：\n1. OPENAI_API_KEY 是否配置。\n2. 服务是否已重新部署。\n3. /api/analyze、/api/generate-stage、/api/report 是否返回 500 或超时。\n4. OpenAI 账户额度、项目权限或模型名是否可用。`);
    renderStages();
  } finally {
    runBtn.disabled = false;
  }
}

function resetInput() {
  selectedImage = "";
  generatedStages = [];
  analysisResult = null;
  reportResult = null;
  setError("");
  preview.removeAttribute("src");
  mediaBox.classList.remove("has-image");
  setStatus("外层屏幕为 16:9，输入画面为横向 4:3。");
  renderResult();
}

function captureCamera() {
  if (!camera.videoWidth || !camera.videoHeight) {
    setStatus("摄像头画面还没有准备好。");
    return;
  }
  const targetRatio = 4 / 3;
  const sourceRatio = camera.videoWidth / camera.videoHeight;
  let sx = 0;
  let sy = 0;
  let sw = camera.videoWidth;
  let sh = camera.videoHeight;
  if (sourceRatio > targetRatio) {
    sw = camera.videoHeight * targetRatio;
    sx = (camera.videoWidth - sw) / 2;
  } else {
    sh = camera.videoWidth / targetRatio;
    sy = (camera.videoHeight - sh) / 2;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  context.drawImage(camera, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  setSelectedImage(canvas.toDataURL("image/png"));
}

function setupDrawing() {
  const ctx = drawCanvas.getContext("2d");
  function clear() {
    ctx.fillStyle = "#f7fbfd";
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  }

  function point(event) {
    const rect = drawCanvas.getBoundingClientRect();
    const client = event.touches?.[0] || event;
    return {
      x: ((client.clientX - rect.left) / rect.width) * drawCanvas.width,
      y: ((client.clientY - rect.top) / rect.height) * drawCanvas.height,
    };
  }

  function drawShape(from, to) {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);
    if (width < 3 || height < 3) return;
    ctx.fillStyle = brushColor;
    ctx.beginPath();
    if (activeShape === "circle") {
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (activeShape === "triangle") {
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (activeShape === "semicircle") {
      ctx.moveTo(x, y + height);
      ctx.ellipse(x + width / 2, y + height, width / 2, height, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.fillRect(x, y, width, height);
  }

  function begin(event) {
    drawing = true;
    dragStart = point(event);
    dragSnapshot = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
    event.preventDefault();
  }

  function move(event) {
    if (!drawing || !dragStart || !dragSnapshot) return;
    ctx.putImageData(dragSnapshot, 0, 0);
    drawShape(dragStart, point(event));
    event.preventDefault();
  }

  function end(event) {
    if (!drawing) return;
    if (dragSnapshot) {
      ctx.putImageData(dragSnapshot, 0, 0);
      drawShape(dragStart, point(event));
    }
    drawing = false;
    dragStart = null;
    dragSnapshot = null;
  }

  clear();
  colorSwatches?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button) return;
    brushColor = button.dataset.color;
    colorSwatches.querySelectorAll(".swatch").forEach((item) => item.classList.toggle("active", item === button));
  });
  shapeTools?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-shape]");
    if (!button) return;
    activeShape = button.dataset.shape;
    shapeTools.querySelectorAll(".shape-btn").forEach((item) => item.classList.toggle("active", item === button));
  });
  drawCanvas.addEventListener("pointerdown", begin);
  drawCanvas.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  clearCanvasBtn.addEventListener("click", () => {
    clear();
    setStatus("画布已清空。");
  });
  useDrawingBtn.addEventListener("click", () => {
    setSelectedImage(drawCanvas.toDataURL("image/png"));
    setStatus("画作已作为输入，可以开始生成。");
  });
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.next));
});

modeCameraBtn.addEventListener("click", () => setInputMode("camera"));
modeDrawBtn.addEventListener("click", () => setInputMode("draw"));
captureBtn.addEventListener("click", captureCamera);
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      setSelectedImage(await imageToFourThreeDataUrl(String(reader.result)));
    } catch {
      setSelectedImage(String(reader.result));
    }
  };
  reader.readAsDataURL(file);
});

runBtn.addEventListener("click", () => runApi());
document.querySelector("#restartBtn").addEventListener("click", () => {
  resetInput();
  setView("start");
});

setupDrawing();
renderResult();
