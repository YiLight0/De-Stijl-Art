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
const fileInput = document.querySelector("#fileInput");
const statusText = document.querySelector("#statusText");
const stageGrid = document.querySelector("#stageGrid");
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
  { key: "stage_3_objectified_color_image", title: "第3张：对象化色面图", note: "同一语义的色面转译" },
  { key: "stage_2_structural_sketch", title: "第2张：结构草图", note: "同一语义的结构转译" },
  { key: "stage_1_representational_sketch", title: "第1张：具象素描", note: "同一语义的具象转译" },
];

let stream = null;
let selectedImage = "";
let analysisResult = null;
let reportResult = null;
let generatedStages = [];

function setStatus(text) {
  statusText.textContent = text;
}

function setView(name) {
  const index = viewOrder.indexOf(name);
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === name));
  progressItems.forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
  if (name === "input") startCamera();
  if (name === "process") renderStages();
  if (name === "result") renderResult();
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
    setStatus("摄像头不可用，请上传照片。");
  }
}

function setSelectedImage(dataUrl) {
  selectedImage = dataUrl;
  preview.src = dataUrl;
  mediaBox.classList.add("has-image");
  setStatus("图片已准备好，可以开始生成。");
}

function fallbackSvg(title, variant) {
  const colors = [
    ["#f4eadc", "#19120e", "#be4938", "#2f5f80", "#d7a33e"],
    ["#e5d5c0", "#2d241e", "#a95849", "#5b7183", "#c79742"],
    ["#d0bea5", "#55483c", "#8e4d43", "#7d8c94", "#b88b3f"],
  ][variant];
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
      <text x="58" y="714" font-family="Arial" font-size="34" font-weight="700" fill="${ink}">${title}</text>
    </svg>
  `)}`;
}

function stageCards() {
  return [
    { title: "第4张：抽象终稿", note: "用户输入", imageBase64: selectedImage, pending: false },
    ...stageMeta.map((meta, index) => ({
      title: generatedStages[index]?.title || meta.title,
      note: generatedStages[index] ? meta.note : "生成中",
      imageBase64: generatedStages[index]?.imageBase64 || fallbackSvg("生成中", index),
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
          <div>
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
  const captionsByIndex = [captions.original, captions.stage3, captions.stage2, captions.stage1];
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
  const words = Array.isArray(analysisResult?.semanticWords) ? analysisResult.semanticWords.join(" · ") : "";
  const persona = reportResult?.persona || reportResult?.primaryArtist?.name || "";
  const score = reportResult?.match_score || reportResult?.matchPercent || 0;
  reportTitle.textContent = reportResult?.title || (persona ? `你是${persona}` : "生成报告");
  reportSubtitle.textContent = reportResult?.subtitle || words || "等待 LLM 撰写报告。";
  matchPercent.textContent = score ? `${score}%` : "--";
  mbtiCode.textContent = reportResult?.mbti?.code || "STIJL";
  mbtiName.textContent = reportResult?.mbti?.name || persona || "大师人格生成中";
  reportThesis.textContent =
    reportResult?.mbti?.summary ||
    reportResult?.why?.join(" ") ||
    reportResult?.primaryArtist?.reason ||
    analysisResult?.semanticSentence ||
    "生成完成后，这里会出现一份更详细的大师人格解读。";

  const dimensions = reportResult?.dimensions || [
    { label: "秩序", value: 0 },
    { label: "动态", value: 0 },
    { label: "空间", value: 0 },
    { label: "色面", value: 0 },
    { label: "比例", value: 0 },
    { label: "叙事", value: 0 },
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
    { name: "蒙德里安", score: 0, trait: "纯粹关系", note: "等待匹配。" },
    { name: "范·杜斯堡", score: 0, trait: "动态张力", note: "等待匹配。" },
    { name: "里特维德", score: 0, trait: "空间结构", note: "等待匹配。" },
    { name: "范德莱克", score: 0, trait: "色彩自主", note: "等待匹配。" },
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
    (comment
      ? `结构：${comment.structure} 色彩：${comment.color} 抽象：${comment.abstraction} 逆推潜力：${comment.reverse_potential}`
      : "");
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
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function generateStagesOneByOne() {
  generatedStages = [];
  reportResult = null;
  renderStages();

  for (let index = 0; index < stageMeta.length; index += 1) {
    const meta = stageMeta[index];
    setStatus(`正在生成：${meta.title}`);
    const prompt =
      analysisResult?.stagePrompts?.[meta.key] ||
      analysisResult?.generation_constraints?.stage_targets?.[meta.key] ||
      `${meta.title}，基于同一份抽象图逆推语义说明书生成，必须保留原图构图语义、重心、比例、留白、主要方向和对象类别，不能生成无关内容，4:3 横构图，展览级审美，画面中绝对无文字、无字母、无数字、无符号、无标牌、无签名、无水印。`;
    const result = await postJson("/api/generate-stage", {
      title: meta.title,
      prompt,
    });
    generatedStages[index] = result;
    renderStages();
  }

  setStatus("三张图已生成完成，正在撰写报告。");
  reportResult = await postJson("/api/report", {
    analysis: analysisResult,
    stages: stageCards().map(({ title, note }) => ({ title, note })),
  });
  renderResult();
  setStatus("图片与报告已生成完成。");
}

async function runApi({ testOnly = false } = {}) {
  if (!selectedImage) {
    setStatus("请先拍摄或上传一张图片。");
    return;
  }

  runBtn.disabled = true;
  testBtn.disabled = true;
  setStatus(testOnly ? "正在测试 API..." : "正在进行视觉语义提取...");

  try {
    if (!testOnly) {
      generatedStages = [];
      reportResult = null;
      setView("process");
      renderStages();
    }

    analysisResult = await postJson("/api/analyze", { imageBase64: selectedImage });
    renderResult();

    if (testOnly) {
      const testResult = await postJson("/api/test-image", {
        stagePrompts: analysisResult.stagePrompts,
      });
      const reportTest = await postJson("/api/report", {
        analysis: analysisResult,
        stages: [{ title: "测试图", note: "API 测试" }],
      });
      setStatus(`测试成功：生图模型返回 ${testResult.imageCount} 张图，报告模型返回《${reportTest.title}》。`);
      return;
    }

    await generateStagesOneByOne();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "API 调用失败。");
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
  preview.removeAttribute("src");
  mediaBox.classList.remove("has-image");
  setStatus("外层屏幕为 16:9，摄像头与生成图保持 4:3。");
  renderResult();
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.next));
});

captureBtn.addEventListener("click", () => {
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
});

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

renderResult();
