const fs = require("fs");
const path = require("path");

const OPENAI_API_URL = "https://api.openai.com/v1";

const apiKey = process.env.OPENAI_API_KEY || readEnvFile("OPENAI_API_KEY");
const visionModel = process.env.OPENAI_VISION_MODEL || readEnvFile("OPENAI_VISION_MODEL") || "gpt-4.1";
const reportModel = process.env.OPENAI_REPORT_MODEL || readEnvFile("OPENAI_REPORT_MODEL") || "gpt-4.1";
const imageModel = process.env.OPENAI_IMAGE_MODEL || readEnvFile("OPENAI_IMAGE_MODEL") || "gpt-image-1";
const imageSize = process.env.OPENAI_IMAGE_SIZE || readEnvFile("OPENAI_IMAGE_SIZE") || "1536x1024";

function readEnvFile(name) {
  const root = path.resolve(__dirname, "..");
  for (const envPath of [path.join(root, ".env.local"), path.join(root, ".env")]) {
    try {
      const raw = fs.readFileSync(envPath, "utf8");
      const line = raw
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find((item) => item && !item.startsWith("#") && item.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
    } catch {
      // Try the next env file.
    }
  }
  return "";
}

function requireKey() {
  if (!apiKey || apiKey.includes("YOUR")) {
    throw new Error("Missing OPENAI_API_KEY in environment variables.");
  }
}

function normalizeImageInput(image) {
  if (!image) throw new Error("Missing image.");
  if (image.startsWith("data:image/")) return image;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `data:image/png;base64,${image}`;
}

function stripJsonFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function openaiJson(endpoint, body) {
  requireKey();
  const response = await fetch(`${OPENAI_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    const message = data.error?.message || data.error || text;
    throw new Error(`${response.status} ${message}`);
  }
  return data;
}

async function openaiMultipart(endpoint, form) {
  requireKey();
  const response = await fetch(`${OPENAI_API_URL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data.error?.message || data.error || text;
    throw new Error(`${response.status} ${message}`);
  }
  return data;
}

async function imageToBlob(image) {
  const normalized = normalizeImageInput(image);
  if (normalized.startsWith("data:image/")) {
    const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL image.");
    return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
  }

  const response = await fetch(normalized);
  if (!response.ok) throw new Error(`Failed to fetch source image: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/png";
  return new Blob([Buffer.from(await response.arrayBuffer())], { type: contentType });
}

function buildVisionPrompt() {
  return `
你是“风格派倒推实验室”的视觉分析引擎。请基于用户上传的作品图像进行分析。作品可能来自手绘、拼贴、拼豆、色块材料或其他手作媒介。你的任务不是判断作品好坏，而是提取它与风格派相关的形式特征，并为后续图生图倒推提供结构化证据。

重要限制：
- 不要把画面解释成积木、乐高、玩具砖或儿童玩具。
- 不要默认解释成椅子、红蓝椅、家具或室内结构，除非视觉证据非常明确。
- 不要给出唯一真相，只给“可能来源”和“视觉线索支持”。
- 候选来源可以是动物、建筑、家具、机器、风景、人体姿态、器物、植物或工具，但必须由图像中的重心、色块、线条和空白支持。

请只输出 JSON，不要输出散文。若无法确定，请用 unknown 或给出 2-3 个候选，不要编造唯一答案。

输出格式：
{
  "image_quality": {
    "usable": true,
    "issues": ["透视倾斜", "边缘遮挡", "光照不均"],
    "preprocess_needed": ["crop", "perspective_correction", "background_removal"]
  },
  "formal_features": {
    "dominant_lines": ["horizontal", "vertical"],
    "diagonal_presence": "none / slight / strong",
    "shape_units": ["rectangle", "square", "thin_bar"],
    "color_palette": ["red", "yellow", "blue", "black", "white", "gray"],
    "negative_space": "low / medium / high",
    "asymmetrical_balance": "low / medium / high"
  },
  "de_stijl_scores": {
    "orthogonal_order": 0,
    "primary_color_control": 0,
    "flatness": 0,
    "abstraction_depth": 0,
    "dynamic_tension": 0
  },
  "reverse_clues": [
    { "visual_clue": "large horizontal rectangle", "possible_meaning": "body / table top / building facade", "confidence": 0.0 }
  ],
  "candidate_source_types": [
    { "type": "animal / architecture / furniture / machine / landscape / human pose", "confidence": 0.0, "reason": "" }
  ],
  "semanticWords": ["5-10 个中文关键词"],
  "semanticSentence": "一句有画面感的语义总结",
  "stagePrompts": {
    "stage_2_structural_sketch": "图生图结构草图提示词，必须保留原图比例、重心、方向和空白，绝对无文字。",
    "stage_1_representational_sketch": "图生图实体素描提示词，必须从原图色块与线条恢复对象体量，绝对无文字。",
    "stage_realistic_candidate": "图生图写实候选提示词，必须保留原图构图逻辑，绝对无文字。"
  },
  "shortComment": ""
}`;
}

async function analyzeImage(imageBase64) {
  const image = normalizeImageInput(imageBase64);
  const data = await openaiJson("/chat/completions", {
    model: visionModel,
    messages: [
      { role: "system", content: "你只输出严格 JSON，不要 Markdown。" },
      {
        role: "user",
        content: [
          { type: "text", text: buildVisionPrompt() },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI vision model returned empty content.");
  return JSON.parse(stripJsonFence(content));
}

function buildImagePrompt(prompt, title) {
  return `
${title}

你正在执行“风格派倒推实验室”的图生图任务。请把输入图片视为同一件抽象作品的最终形态，不要自由发明无关场景。必须从输入图片本身出发，保留它的主要色块位置、横竖斜关系、重心、比例、留白、疏密节奏和整体姿态，只改变抽象程度与表现方式。

硬性约束：
1. 画面中绝对不能出现任何文字、字母、数字、符号、标牌、标签、签名、水印、logo 或 UI。
2. 不要生成积木、乐高、玩具砖、儿童玩具或拼装玩具。
3. 不要默认生成椅子、红蓝椅、家具或室内结构，除非输入图像中有极明确证据。
4. 生成内容必须和输入图片的结构有关，不能换成完全无关的物体或新场景。
5. 构图保持 4:3 横构图感，背景简洁，展览级审美。

阶段要求：
${prompt}

再次确认：纯图像，无文字、无字母、无数字、无符号、无标牌、无签名、无水印。
`;
}

async function editImage(imageBase64, prompt, title) {
  const sourceImage = await imageToBlob(imageBase64);
  const form = new FormData();
  form.append("model", imageModel);
  form.append("image", sourceImage, "source.png");
  form.append("prompt", buildImagePrompt(prompt, title));
  form.append("size", imageSize);
  form.append("n", "1");

  const data = await openaiMultipart("/images/edits", form);
  const result = data.data?.[0];
  if (!result?.b64_json && !result?.url) {
    throw new Error("OpenAI image edit model returned no image.");
  }
  return result.b64_json ? `data:image/png;base64,${result.b64_json}` : result.url;
}

async function buildReport(analysis, stages) {
  const prompt = `
你是风格派互动展的讲解员。请根据作品分析结果，为用户生成一份“作品分析 + 风格派大师人格”报告。语气像博物馆互动装置：友好、准确、有启发，不像考试打分。

候选人格：
1. 蒙德里安｜秩序平衡型：重视水平/垂直、纯粹关系、非对称平衡、克制用色。
2. 杜斯伯格｜动态突破型：接受斜线、速度感、构成冲突和更强的运动张力。
3. 里特维德｜空间建构型：把平面原则转入家具、建筑、结构和空间关系。
4. 范德莱克｜色面叙事型：从具象对象出发，用平面色块保留叙事痕迹。
5. 范通格洛｜比例理性型：偏向数学关系、比例秩序、冷静的结构推演。

语言模型评价标准，总分 100 分，用于生成“作品分析”而不是给用户排名：
- 风格派形式契合度 25：水平/垂直、矩形、原色与非色、平面化、非对称平衡。
- 抽象转译逻辑 25：是否能从现实对象提炼结构，而不是只贴颜色。
- 倒推可解释性 20：色块、重心、支撑、空白是否能支持合理候选。
- 创作表达与互动性 20：用户意图是否可被讲述，评价是否能激发二次修改。
- 展示留存完整度 10：是否适合生成四联推演卡、作品墙或分享图。

评价时必须遵守：
1. 不说“你画错了”，改说“如果想更接近某某大师，可以尝试……”。
2. 不把倒推结果说成事实，只说“可能来源”“视觉线索支持”。
3. 不鼓励上传人脸、身份证、票据等私人信息。
4. 对儿童或普通公众作品使用鼓励性语言，对课程汇报版本可增加设计术语。

报告要求：
- 必须且只能匹配一位 persona。
- dimensions 必须对应上面的五项评分，value 使用每项折算后的 0-100 展示值，note 写一句解释。
- narrative 要像展览文案，有趣但具体。
- next_interaction 必须给出一个可以继续修改作品的建议。

作品分析：
${JSON.stringify(analysis, null, 2)}

生成链路：
${JSON.stringify(stages, null, 2)}

严格返回 JSON：
{
  "persona": "",
  "match_score": 0,
  "why": ["", "", ""],
  "work_comment": {
    "structure": "",
    "color": "",
    "abstraction": "",
    "reverse_potential": ""
  },
  "next_interaction": "",
  "dimensions": [
    { "label": "形式", "value": 0, "note": "风格派形式契合度 /25" },
    { "label": "转译", "value": 0, "note": "抽象转译逻辑 /25" },
    { "label": "倒推", "value": 0, "note": "倒推可解释性 /20" },
    { "label": "互动", "value": 0, "note": "创作表达与互动性 /20" },
    { "label": "留存", "value": 0, "note": "展示留存完整度 /10" }
  ],
  "artistMatches": [
    { "name": "", "score": 0, "trait": "", "note": "" }
  ],
  "stageCaptions": {
    "original": "",
    "stage2": "",
    "stage1": "",
    "realistic": "",
    "stage3": ""
  },
  "title": "",
  "subtitle": "",
  "mbti": { "code": "", "name": "", "summary": "" },
  "primaryArtist": { "name": "", "reason": "" },
  "narrative": "",
  "quote": "",
  "closing": ""
}`;

  const data = await openaiJson("/chat/completions", {
    model: reportModel,
    messages: [
      { role: "system", content: "你是风格派互动展的讲解员。你只输出严格 JSON。" },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature: 0.72,
    response_format: { type: "json_object" },
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI report model returned empty content.");
  return JSON.parse(stripJsonFence(content));
}

function sendOk(res, data) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function sendError(res, error) {
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Server error" }));
}

module.exports = {
  analyzeImage,
  editImage,
  buildReport,
  sendOk,
  sendError,
  imageModel,
};
