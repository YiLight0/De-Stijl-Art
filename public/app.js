const views = Array.from(document.querySelectorAll(".view"));
const progressItems = Array.from(document.querySelectorAll(".progress-item"));
const camera = document.querySelector("#camera");
const preview = document.querySelector("#preview");
const mediaBox = document.querySelector(".media-box");
const captureBtn = document.querySelector("#captureBtn");
const uploadBtn = document.querySelector("#uploadBtn");
const runBtn = document.querySelector("#runBtn");
const testBtn = document.querySelector("#testBtn");
const resetImageBtn = document.querySelector("#resetImageBtn");
const clearCanvasBtn = document.querySelector("#clearCanvasBtn");
const useDrawingBtn = document.querySelector("#useDrawingBtn");
const modeCameraBtn = document.querySelector("#modeCameraBtn");
const modeDrawBtn = document.querySelector("#modeDrawBtn");
const drawCanvas = document.querySelector("#drawCanvas");
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
      "请根据这张风格派抽象图像，倒推出它可能来源于的现实对象结构。不要直接生成写实图像。生成一张黑白结构性草图：将图中的矩形色块、水平线、垂直线、视觉重心和空白区转译为可能的对象骨架。保留抽象图中的主要比例关系、方向关系和空间布局。画面应像艺术家从风格派构成反推出来的分析草图，线条清晰，少量辅助线，白色背景，铅笔或炭笔风格。绝对不要出现文字。",
  },
  {
    key: "stage_1_representational_sketch",
    title: "实体素描",
    note: "恢复体积，但保留原图比例与姿态",
    fallbackPrompt:
      "请将这张风格派抽象构成倒推为一个可能的现实对象素描。根据图中的大色块判断主体体块，根据竖向元素判断支撑结构，根据横向元素判断身体、梁、桌面或主要延展方向，根据小色块判断头部、关节、窗洞或局部节点。生成一张介于结构草图和具象素描之间的图像。对象需要具有真实的体积和轮廓，但仍保留原始风格派图像的构图比例和重心关系。黑白铅笔素描，简洁背景。绝对不要出现文字。",
  },
  {
    key: "stage_realistic_candidate",
    title: "写实候选",
    note: "把相同构图线索转译成可能来源",
    fallbackPrompt:
      "请根据这张风格派抽象图像推测它可能来自什么现实对象，并生成一张可能的写实候选图像。必须保留原图中的主要构图逻辑：横向与竖向关系、主体重心、块面比例、左右疏密关系和空间节奏。将矩形色块转译为真实对象的身体、结构、支撑、开口或局部部件。不要宣称唯一答案，图像只呈现一个合理候选。写实素描或低饱和写实摄影感，真实材质，简洁背景。绝对不要出现文字。",
  },
];

let stream = null;
let selectedImage = "";
let inputMode = "camera";
let analysisResult = null;
let reportResult = null;
let generatedStages = [];
let drawing = false;

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
  setStatus(mode === "draw" ? "在画布上画一张抽象作品，然后点击“使用画作”。" : "摄像头模式：拍摄或上传一张 4:3 作品。");
  if (mode === "camera") startCamera();
}

async function startCamera() {
  if (stream || !navigator.mediaDevices?.getUserMedia) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 960 },
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

function fallbackSvg(variant) {
  const colors = [
    ["#f7fbfd", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
    ["#edf5f8", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
    ["#dfeaf0", "#111417", "#ef2c2f", "#0877c9", "#f0c929"],
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
  reportSubtitle.textContent = reportResult?.subtitle || words || "等待 LLM 撰写报告。";
  matchPercent.textContent = score ? `${score}%` : "--";
  mbtiCode.textContent = reportResult?.mbti?.code || "STIJL";
  mbtiName.textContent = reportResult?.mbti?.name || persona || "艺术家人格生成中";
  reportThesis.textContent =
    reportResult?.mbti?.summary ||
    reportResult?.why?.join(" ") ||
    reportResult?.primaryArtist?.reason ||
    analysisResult?.semanticSentence ||
    "生成完成后，这里会出现一份更详细的艺术解读。";

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
  }

  setStatus("三张图已生成完成，正在撰写作品分析报告。");
  reportResult = await postJson("/api/report", {
    analysis: analysisResult,
    stages: stageCards().map(({ title, note }) => ({ title, note })),
  });
  renderResult();
  setStatus("图片与报告已生成完成。");
}

async function runApi({ testOnly = false } = {}) {
  if (!selectedImage) {
    setStatus(inputMode === "draw" ? "请先点击“使用画作”。" : "请先拍摄或上传一张图片。");
    return;
  }

  runBtn.disabled = true;
  testBtn.disabled = true;
  setError("");
  setStatus(testOnly ? "正在测试 API..." : "正在提取风格派形式特征...");

  try {
    if (!testOnly) {
      generatedStages = [];
      reportResult = null;
      setView("process");
      renderStages();
    }

    analysisResult = await postJson("/api/analyze", { imageBase64: selectedImage });

    if (testOnly) {
      const testResult = await postJson("/api/test-image", {
        imageBase64: selectedImage,
        stagePrompts: analysisResult.stagePrompts,
      });
      const reportTest = await postJson("/api/report", {
        analysis: analysisResult,
        stages: [{ title: "测试图", note: "API 测试" }],
      });
      setStatus(`测试成功：生图模型返回 ${testResult.imageCount} 张图，报告模型返回《${reportTest.title || "测试报告"}》。`);
      return;
    }

    await generateStagesOneByOne();
  } catch (error) {
    const message = error instanceof Error ? error.message : "API 调用失败。";
    setStatus(message.split("\n")[0]);
    setError(`生成失败\n\n${message}\n\n请检查：\n1. Vercel 环境变量 OPENAI_API_KEY 是否配置在当前环境。\n2. Vercel 是否已重新部署。\n3. /api/analyze、/api/generate-stage、/api/report 是否返回 500 或超时。\n4. OpenAI 账户额度、项目权限或模型名是否可用。\n5. 图生图模型是否支持当前 OPENAI_IMAGE_SIZE。`);
    if (!testOnly) renderStages();
  } finally {
    runBtn.disabled = false;
    testBtn.disabled = false;
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
  setStatus("外层屏幕为 16:9，输入画面保持 4:3。");
  renderResult();
}

function captureCamera() {
  if (!camera.videoWidth || !camera.videoHeight) {
    setStatus("摄像头画面还没有准备好。");
    return;
  }
  const sourceRatio = camera.videoWidth / camera.videoHeight;
  const targetRatio = 4 / 3;
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
    ctx.lineWidth = 22;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = "#111417";
  }

  function point(event) {
    const rect = drawCanvas.getBoundingClientRect();
    const client = event.touches?.[0] || event;
    return {
      x: ((client.clientX - rect.left) / rect.width) * drawCanvas.width,
      y: ((client.clientY - rect.top) / rect.height) * drawCanvas.height,
    };
  }

  function begin(event) {
    drawing = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    event.preventDefault();
  }

  function move(event) {
    if (!drawing) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    event.preventDefault();
  }

  function end() {
    drawing = false;
  }

  clear();
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
  reader.onload = () => setSelectedImage(String(reader.result));
  reader.readAsDataURL(file);
});

runBtn.addEventListener("click", () => runApi());
testBtn.addEventListener("click", () => runApi({ testOnly: true }));
resetImageBtn.addEventListener("click", resetInput);
document.querySelector("#restartBtn").addEventListener("click", () => {
  resetInput();
  setView("start");
});

setupDrawing();
renderResult();
