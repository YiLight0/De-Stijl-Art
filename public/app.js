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
  {
    key: "stage_2_structural_sketch",
    title: "结构草图",
    note: "抽出骨架、支撑、重心与空白",
    fallbackPrompt:
      "生成黑白结构性草图。请把输入图中的色块、线条、重心和空白转译为可能对象的骨架、支撑、连接关系和主要轮廓。不要写实，不要继续纯抽象，白色背景，铅笔或炭笔线稿，绝对不要出现文字。",
  },
  {
    key: "stage_1_representational_sketch",
    title: "具象素描",
    note: "必须画出可识别的真实对象",
    fallbackPrompt:
      "生成一张具象素描。它必须是一个可识别的现实对象或场景，而不是抽象几何图。请根据输入图的色块、支撑、重心和方向恢复对象的外轮廓、体积、局部结构和少量明暗。保留原图构图关系，但要明显更具象、更像艺术家观察现实对象时的铅笔素描。禁止生成抽象构成、色块拼贴、几何海报或文字。",
  },
  {
    key: "stage_realistic_candidate",
    title: "写实候选",
    note: "把相同构图线索转译成可能来源",
    fallbackPrompt:
      "生成一张可能来源的写实候选图像。必须保留输入图的主要构图逻辑：重心、比例、方向、左右疏密和空间节奏。将色块转译为真实对象的身体、结构、支撑、开口或局部部件。不要宣称唯一答案，只呈现一个视觉线索支持的候选。简洁背景，绝对不要出现文字。",
  },
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
  setStatus(mode === "draw" ? "在方形画布上拖拽生成实心图形，然后点击“使用画作”。" : "摄像头模式：拍摄或上传一张方形作品。");
  if (mode === "camera") startCamera();
}

async function startCamera() {
  if (stream || !navigator.mediaDevices?.getUserMedia) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1024 },
        height: { ideal: 1024 },
        aspectRatio: { ideal: 1 },
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

function imageToSquareDataUrl(source, size = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = "#f7fbfd";
      context.fillRect(0, 0, size, size);
      context.drawImage(img, sx, sy, side, side, 0, 0, size, size);
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
  ][variant] || ["#f7fbfd", "#111417", "#ef2c2f", "#0877c9", "#f0c929"];
  const [bg, ink, red, blue, yellow] = colors;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" fill="${bg}"/>
      <rect x="120" y="110" width="58" height="760" fill="${ink}"/>
      <rect x="120" y="370" width="790" height="58" fill="${ink}"/>
      <rect x="440" y="110" width="42" height="760" fill="${ink}"/>
      <rect x="536" y="150" width="260" height="240" fill="${blue}"/>
      <rect x="210" y="520" width="210" height="160" fill="${red}"/>
      <rect x="760" y="720" width="150" height="150" fill="${yellow}"/>
    </svg>
  `)}`;
}

function stageCards() {
  const original = selectedImage ? [{ title: "用户作品", note: "输入的抽象终稿", imageBase64: selectedImage, pending: false }] : [];
  return [
    ...original,
    ...stageMeta.map((meta, index) => ({
      title: generatedStages[index]?.title || meta.title,
      note: generatedStages[index] ? meta.note : "生成中",
      imageBase64: generatedStages[index]?.imageBase64 || fallbackSvg(index),
      pending: !generatedStages[index],
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

function promptForStage(meta) {
  return analysisResult?.stagePrompts?.[meta.key] || meta.fallbackPrompt;
}

async function generateStagesOneByOne() {
  generatedStages = [];
  reportResult = null;
  setError("");
  renderStages();

  for (let index = 0; index < stageMeta.length; index += 1) {
    const meta = stageMeta[index];
    setStatus(`正在图生图：${meta.title}`);
    const result = await postJson("/api/generate-stage", {
      title: meta.title,
      prompt: promptForStage(meta),
      imageBase64: selectedImage,
    });
    generatedStages[index] = result;
    renderStages();
    if (views.find((view) => view.dataset.view === "result")?.classList.contains("active")) {
      renderResult();
    }
  }

  setStatus("三张图已生成完成，正在撰写作品分析报告。");
  setView("result");
  reportResult = await postJson("/api/report", {
    analysis: analysisResult,
    stages: stageCards().map(({ title, note }) => ({ title, note })),
  });
  renderResult();
  setStatus("图片与报告已生成完成。");
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
    await generateStagesOneByOne();
  } catch (error) {
    const message = error instanceof Error ? error.message : "API 调用失败。";
    setStatus(message.split("\n")[0]);
    setError(`生成失败\n\n${message}\n\n请检查：\n1. OPENAI_API_KEY 是否配置。\n2. 服务是否已重新部署。\n3. /api/analyze、/api/generate-stage、/api/report 是否返回 500 或超时。\n4. OpenAI 账户额度、项目权限或模型名是否可用。\n5. 图生图模型是否支持当前 OPENAI_IMAGE_SIZE。`);
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
  setStatus("外层屏幕为 16:9，输入画面为方形。");
  renderResult();
}

function captureCamera() {
  if (!camera.videoWidth || !camera.videoHeight) {
    setStatus("摄像头画面还没有准备好。");
    return;
  }
  const side = Math.min(camera.videoWidth, camera.videoHeight);
  const sx = (camera.videoWidth - side) / 2;
  const sy = (camera.videoHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  context.drawImage(camera, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
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
      setSelectedImage(await imageToSquareDataUrl(String(reader.result)));
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
