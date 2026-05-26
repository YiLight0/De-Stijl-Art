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

async function openaiJson(path, body) {
  requireKey();
  const response = await fetch(`${OPENAI_API_URL}${path}`, {
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

function buildVisionPrompt() {
  return `
你是“抽象艺术创作逆推实验室”的视觉分析引擎。请把用户上传的抽象图理解为第4张抽象终稿，并输出一份用于后续三次文生图的“中间语义说明书”。

重要限制：
- 不要把画面解释成积木、乐高、玩具砖、拼装玩具或儿童玩具。
- 不要默认解释成椅子、红蓝椅、家具或室内结构，除非证据非常明确。
- 块状结构可以来自动物、植物、器物、建筑、人体姿态、机械部件、风景切面、工具或抽象材料关系。

流程：第4张抽象终稿 -> 结构化语义说明书 -> 第3张对象化色面图 -> 第2张结构草图 -> 第1张具象素描。
关键原则：一次理解，三次转译。后三张图都只基于这份语义说明书生成。

请只输出 JSON：
{
  "semanticWords": ["5-10 个中文词语"],
  "semanticSentence": "一句有画面感的语义总结",
  "image_summary": {
    "abstraction_level": "low / medium / high / extreme",
    "overall_description": "",
    "visual_center": "",
    "balance_type": "",
    "spatial_rhythm": "",
    "dominant_directions": ["horizontal", "vertical", "diagonal"]
  },
  "formal_elements": {
    "major_blocks": [],
    "major_lines": [],
    "negative_space": { "amount": "", "main_position": "", "possible_meaning": "" }
  },
  "candidate_sources": [],
  "selected_source": { "name": "", "reason": "", "confidence": 0.0 },
  "possibleOrigin": "",
  "element_mapping": [],
  "generation_constraints": {
    "must_preserve": [],
    "may_change": [],
    "stage_targets": {
      "stage_3_objectified_color_image": "",
      "stage_2_structural_sketch": "",
      "stage_1_representational_sketch": ""
    }
  },
  "prompt_base": {
    "one_sentence_subject_summary": "",
    "composition_summary": "",
    "object_structure_summary": ""
  },
  "stagePrompts": {
    "stage_3_objectified_color_image": "对象化色面图提示词。必须保留原图构图语义，绝对无文字。",
    "stage_2_structural_sketch": "结构草图提示词。必须保留原图结构关系，绝对无文字。",
    "stage_1_representational_sketch": "具象素描提示词。必须保留同一对象类别，绝对无文字。"
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
    temperature: 0.75,
    response_format: { type: "json_object" },
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI vision model returned empty content.");
  return JSON.parse(stripJsonFence(content));
}

function buildImagePrompt(prompt, title) {
  return `${title}
你正在执行“抽象艺术创作流程逆推”任务。必须从同一份语义说明书出发，保留原图构图语义、重心、比例节奏、留白、主要色块关系和对象类别，不能生成无关的新物体或新场景。

硬性约束：
1. 必须基于 selected_source、element_mapping、prompt_base、must_preserve。
2. 画面里绝对不能出现任何文字、字母、数字、符号、标牌、标签、签名、水印、logo、伪文字。
3. 不要积木、乐高、玩具砖、拼装玩具或儿童玩具。
4. 不要默认生成椅子、红蓝椅、家具；除非 selected_source 明确选择这类对象。

${prompt}

4:3 横构图感，纯图像，无文字，无字母，无数字，无符号，无标牌，无签名，无水印，无 UI，无边框。`;
}

async function generateImage(prompt, title) {
  const data = await openaiJson("/images/generations", {
    model: imageModel,
    prompt: buildImagePrompt(prompt, title),
    size: imageSize,
    quality: "medium",
    n: 1,
  });

  const result = data.data?.[0];
  if (!result?.b64_json && !result?.url) {
    throw new Error("OpenAI image model returned no image.");
  }
  return result.b64_json ? `data:image/png;base64,${result.b64_json}` : result.url;
}

async function buildReport(analysis, stages) {
  const prompt = `
你是风格派互动展的讲解员。请根据作品分析结果，为用户匹配一个“风格派大师人格”。语气要像博物馆互动装置：友好、准确、有启发，不要像考试打分。

候选人格：
1. 蒙德里安｜秩序平衡型：重视水平/垂直、纯粹关系、非对称平衡、克制用色。
2. 杜斯伯格｜动态突破型：接受斜线、速度感、构成冲突和更强的运动张力。
3. 里特维德｜空间建构型：把平面原则转入家具、建筑、结构和空间关系。
4. 范德莱克｜色面叙事型：从具象对象出发，用平面色块保留叙事痕迹。
5. 范通格洛｜比例理性型：偏向数学关系、比例秩序、冷静的结构推演。

作品分析：
${JSON.stringify(analysis, null, 2)}

生成链路：
${JSON.stringify(stages, null, 2)}

必须且只能匹配一个 persona。严格返回 JSON：
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
    { "label": "秩序", "value": 0 },
    { "label": "动态", "value": 0 },
    { "label": "空间", "value": 0 },
    { "label": "色面", "value": 0 },
    { "label": "比例", "value": 0 },
    { "label": "叙事", "value": 0 }
  ],
  "artistMatches": [],
  "stageCaptions": { "original": "", "stage3": "", "stage2": "", "stage1": "" },
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
  generateImage,
  buildReport,
  sendOk,
  sendError,
  imageModel,
};
