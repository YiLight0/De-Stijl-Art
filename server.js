const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);

const apiKey = process.env.SILICONFLOW_API_KEY || readLegacyEnv("SILICONFLOW_API_KEY");
const visionModel = process.env.SILICONFLOW_VISION_MODEL || "Pro/moonshotai/Kimi-K2.6";
const reportModel = process.env.SILICONFLOW_REPORT_MODEL || "MiniMaxAI/MiniMax-M2.5";
const imageModel = process.env.SILICONFLOW_IMAGE_MODEL || "Tongyi-MAI/Z-Image-Turbo";

function readLegacyEnv(name) {
  try {
    const envPath = path.join(root, "legacy-next-app", ".env.local");
    const raw = fs.readFileSync(envPath, "utf8");
    const line = raw.split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25 * 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("请求 JSON 格式不正确"));
      }
    });
    req.on("error", reject);
  });
}

function requireKey() {
  if (!apiKey || apiKey.includes("YOUR")) {
    throw new Error("缺少 SILICONFLOW_API_KEY，请在环境变量或 legacy-next-app/.env.local 中配置");
  }
}

function normalizeJsonText(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeImageInput(image) {
  if (!image) throw new Error("缺少图片");
  if (image.startsWith("data:image/")) return image;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `data:image/png;base64,${image}`;
}

function buildVisionPrompt() {
  return `
你是“抽象艺术创作逆推实验室”的视觉分析引擎。请分析用户上传的抽象构成图像。你的任务不是评价作品，也不是直接生成图像，而是从这张抽象图中提取可用于“逆向创作推演”的结构化语义信息。

重要限制：
- 不要把画面解释成积木、乐高、玩具砖、拼装玩具或儿童玩具场景。
- 不要默认解释成椅子、红蓝椅、家具或室内结构。只有当画面中存在明确的座面、靠背、腿部、承重关系等证据，且它明显优于其他候选时，才可以选择这类对象。
- 块状结构可以来自动物、植物、器物、建筑、人体姿态、机械部件、风景切面、室内空间、工具或抽象材料关系。请让候选对象保持多样，不要被风格派艺术史中的“椅子”案例绑架。

请把这张图理解为某位抽象派艺术家创作流程中的最终抽象结果，也就是第4张抽象终稿。现在需要从它反推出更早期的创作阶段。你要输出一份能够支持后续三次文生图的“中间语义说明书”。

流程为：
输入抽象图（第4张）
-> 第一步：图生文，提取结构化语义
-> 第二步：文生图，生成第3张“对象化色面图”
-> 第三步：文生图，生成第2张“结构草图”
-> 第四步：文生图，生成第1张“具象素描”

关键原则：一次理解，三次转译。后面三次文生图都不再继续看图，只基于你输出的这份语义说明书生成，只是生成目标的抽象程度不同。

分析要求：
1. 识别画面构成：主要色块、线条、留白、疏密、重心、横向/竖向/斜向关系。
2. 提取抽象形式特征：色彩体系、几何形状体系、视觉中心、构图平衡方式、对象感。
3. 推测 2 到 3 个可能现实来源，每个候选都必须给证据。不要宣称唯一正确答案。
4. 选出一个最适合继续逆推的候选对象。
5. 建立“抽象元素 -> 对象部件”的映射。
6. 给出后续生成约束：必须保留什么、可以变化什么、三阶段如何变化。

请严格返回 JSON，不要 Markdown，不要散文。字段如下：
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
    "major_blocks": [
      {
        "id": "block_1",
        "color": "",
        "shape": "",
        "position": "",
        "relative_size": "",
        "visual_role": "",
        "possible_object_part": [],
        "confidence": 0.0
      }
    ],
    "major_lines": [
      {
        "id": "line_1",
        "direction": "",
        "position": "",
        "visual_role": "",
        "possible_object_part": [],
        "confidence": 0.0
      }
    ],
    "negative_space": {
      "amount": "",
      "main_position": "",
      "possible_meaning": ""
    }
  },
  "candidate_sources": [
    {
      "candidate": "",
      "confidence": 0.0,
      "supporting_evidence": [
        {
          "visual_element": "",
          "interpretation": ""
        }
      ],
      "weaknesses": []
    }
  ],
  "selected_source": {
    "name": "",
    "reason": "",
    "confidence": 0.0
  },
  "possibleOrigin": "与 selected_source.name 相同或更具画面感的描述",
  "element_mapping": [
    {
      "abstract_element": "",
      "mapped_object_part": "",
      "reason": "",
      "confidence": 0.0
    }
  ],
  "generation_constraints": {
    "must_preserve": [],
    "may_change": [],
    "stage_targets": {
      "stage_3_objectified_color_image": "第3张：更接近可识别对象的平面色块图",
      "stage_2_structural_sketch": "第2张：更接近对象结构分析草图",
      "stage_1_representational_sketch": "第1张：更接近具象但仍简化的素描"
    }
  },
  "prompt_base": {
    "one_sentence_subject_summary": "",
    "composition_summary": "",
    "object_structure_summary": ""
  },
  "stagePrompts": {
    "stage_3_objectified_color_image": "完整文生图提示词：对象化色面图。必须从 selected_source、element_mapping、composition_summary 和 must_preserve 出发。仍然平面化、几何化、色块化，但对象轮廓开始可识别。保留主要色块位置、重心、横竖斜关系、疏密节奏和留白分布。不要写实，不要素描，不要复杂背景。画面中绝对不能出现任何文字、字母、数字、符号、标牌、签名或水印。",
    "stage_2_structural_sketch": "完整文生图提示词：结构分析草图。必须从 selected_source、element_mapping、composition_summary、object_structure_summary 和 must_preserve 出发。黑白、手绘、非写实、以线条为主，强调对象骨架、支撑关系、主体体量、结构间隙和探索性草图感。不要彩色，不要复杂背景。画面中绝对不能出现任何文字、字母、数字、符号、标注、尺寸线文字、签名或水印。",
    "stage_1_representational_sketch": "完整文生图提示词：具象素描。必须从 selected_source、element_mapping、one_sentence_subject_summary、composition_summary、object_structure_summary 和 must_preserve 出发。黑白具象素描，能清晰识别同一个现实对象，但仍保留手绘、简化、概括和创作初稿感。不要摄影，不要复杂叙事背景，不要卡通。画面中绝对不能出现任何文字、字母、数字、符号、标牌、签名或水印。"
  },
  "shortComment": "一句话说明第4张如何被逆推为第3、第2、第1张"
}

提示词必须具体、可生成、有审美。不要让三次文生图重新猜对象；它们必须共享同一个 selected_source、element_mapping 和 prompt_base。生成目标不能脱离用户输入图像的构图语义，必须能看出与原始抽象图之间的对应关系。所有生成图中绝对不要出现文字、字母、数字、符号、标牌、签名、水印。`;
}

function fallbackAnalysis() {
  return {
    semanticWords: ["秩序", "切面", "光斑", "边界", "静物", "空间", "折叠"],
    semanticSentence: "画面像一处被压缩成色块和线条的室内结构，光线从边缘切入。",
    image_summary: {
      abstraction_level: "high",
      overall_description: "横竖黑色结构切分暖色空间，红蓝黄色块以不同尺度分布在画面中。",
      visual_center: "靠近中央偏右的蓝色色块与水平黑线交汇处",
      balance_type: "不对称平衡",
      spatial_rhythm: "左侧密集支撑，右侧开放延展，底部有稳定色块压住重心",
      dominant_directions: ["horizontal", "vertical"],
    },
    formal_elements: {
      major_blocks: [
        {
          id: "block_blue",
          color: "蓝色",
          shape: "矩形",
          position: "右上区域",
          relative_size: "中等",
          visual_role: "视觉中心与空间开口",
        possible_object_part: ["窗洞", "主体平面", "开口", "躯干侧面", "器物局部"],
          confidence: 0.72,
        },
        {
          id: "block_red",
          color: "红色",
          shape: "矩形",
          position: "左下区域",
          relative_size: "中等偏小",
          visual_role: "低位重心与局部标记",
          possible_object_part: ["低位重心", "底座", "局部器物", "身体局部", "阴影块"],
          confidence: 0.68,
        },
      ],
      major_lines: [
        {
          id: "line_vertical",
          direction: "vertical",
          position: "左侧与中部",
          visual_role: "支撑与边界",
          possible_object_part: ["柱", "椅腿", "窗框"],
          confidence: 0.74,
        },
        {
          id: "line_horizontal",
          direction: "horizontal",
          position: "画面中上部",
          visual_role: "承托与延展",
          possible_object_part: ["梁", "桌沿", "椅背横杆"],
          confidence: 0.7,
        },
      ],
      negative_space: {
        amount: "较多",
        main_position: "上方与右侧",
        possible_meaning: "背景留白、室内空气或结构之间的空隙",
      },
    },
    candidate_sources: [
      {
        candidate: "一个被几何化的器物或空间结构",
        confidence: 0.58,
        supporting_evidence: [
          { visual_element: "横竖黑线", interpretation: "可能是支撑、边界、框架或空间切分" },
          { visual_element: "红蓝色块", interpretation: "可对应主体平面、局部节点、开口或阴影块" },
        ],
        weaknesses: ["对象类别证据不足，不能直接收束为椅子或家具"],
      },
      {
        candidate: "一个侧向的动物、工具或器物轮廓",
        confidence: 0.62,
        supporting_evidence: [
          { visual_element: "低位红色色块", interpretation: "可能是身体重心、底座或局部节点" },
          { visual_element: "水平线", interpretation: "可能是身体延展、工具杆件或器物主轴" },
        ],
        weaknesses: ["需要后续草图阶段补足轮廓关系"],
      },
    ],
    selected_source: {
      name: "一个被几何化的器物或空间结构",
      reason: "横竖支撑、色面节点和开放留白足以支持逆推，但证据不足以固定为椅子或家具。",
      confidence: 0.58,
    },
    possibleOrigin: "一个被几何化的器物或空间结构",
    element_mapping: [
      { abstract_element: "左侧黑色竖条", mapped_object_part: "竖向支撑、边界或身体支点", reason: "位置低且具有承重感", confidence: 0.68 },
      { abstract_element: "中部黑色横条", mapped_object_part: "主轴、横向边界或身体延展", reason: "贯穿画面并建立主体方向", confidence: 0.66 },
      { abstract_element: "蓝色矩形", mapped_object_part: "主体平面、开口或上部体块", reason: "处在视觉中心，像结构中的主要平面", confidence: 0.64 },
      { abstract_element: "红色矩形", mapped_object_part: "低位重心、底座或局部节点", reason: "位于底部并稳定画面重心", confidence: 0.62 },
    ],
    generation_constraints: {
      must_preserve: ["横竖主方向", "左侧支撑密度", "右上视觉中心", "红蓝黄有限配色", "4:3 横构图"],
      may_change: ["局部轮廓完整度", "线条粗细", "明暗层次", "对象细节数量"],
      stage_targets: {
        stage_3_objectified_color_image: "更接近可识别对象的平面色块图，仍保留几何色面语言。",
        stage_2_structural_sketch: "更接近对象结构分析草图，黑白线条表达支撑、体量和连接关系。",
        stage_1_representational_sketch: "更接近具象但简化的素描，清楚呈现对象但不变成照片。",
      },
    },
    prompt_base: {
      one_sentence_subject_summary: "A simplified geometric object or spatial structure with vertical supports, a horizontal axis, colored planes, and open negative space.",
      composition_summary: "The composition is left-weighted with vertical supports, a strong horizontal member across the middle, a blue plane in the upper right, a red plane in the lower left, and generous negative space.",
      object_structure_summary: "The object is built from visible supports, horizontal and vertical members, and flat colored planes that may become body mass, opening, base, edge, node, or structural panels.",
    },
    stagePrompts: {
      stage_3_objectified_color_image:
        "对象化色面图，基于同一份中间语义说明书，一个被几何化的器物、动物、工具、建筑局部或空间结构开始从抽象色块中显露，不要默认成椅子或家具，严格保留左侧竖向支撑、中部水平轴线、右上蓝色平面、左下红色重心与大量留白，平面色块、粗黑边界、有限配色、几何化对象轮廓，艺术家中间创作稿，no text, no letters, no numbers, no symbols, no signature, no watermark, 4:3 landscape",
      stage_2_structural_sketch:
        "结构分析草图，基于同一份中间语义说明书，一个被几何化的器物、动物、工具、建筑局部或空间结构的黑白手绘分析，不要默认成椅子或家具，严格保留原始抽象图的左侧支撑密度、中部横向结构、右上主体平面和左下重心，竖向支撑、水平主轴、主体体块、开口或节点被线条推演出来，白色背景，铅笔与炭笔线条，少量辅助线但无文字标注，局部阴影、探索式线稿，非彩色，no text, no letters, no numbers, no symbols, no labels, no signature, no watermark, 4:3 landscape",
      stage_1_representational_sketch:
        "具象素描，基于同一份中间语义说明书，一个简化的器物、动物、工具、建筑局部或空间结构，必须与原始抽象图的构图、重心、比例和主方向保持对应，不要默认成椅子或家具，清楚可识别，有竖向支撑、横向主轴、主体体块与局部节点，铅笔观察速写，柔和阴影，白色背景，概括体块，艺术家创作初稿，非照片，no text, no letters, no numbers, no symbols, no labels, no signature, no watermark, 4:3 landscape",
    },
    shortComment: "系统先把第4张抽象终稿读成统一语义说明书，再分别转译为第3张色面、第2张结构、第1张素描。",
  };
}

function fallbackReport(analysis = fallbackAnalysis()) {
  return {
    title: "你的风格派人格：空间炼金术师",
    subtitle: "你不是在画一个物体，而是在给现实拆骨。",
    artistType: "Rietveld-Mondrian",
    matchPercent: 86,
    mbti: {
      code: "INTJ-A",
      name: "秩序型空间诗人",
      summary: "你倾向于先建立结构，再允许颜色与材料进入。你不是逃离现实，而是把现实拆成可重新安放的关系。",
    },
    primaryArtist: {
      name: "赫里特·里特费尔德",
      reason: "画面最强的不是颜色，而是空间如何被横竖关系支撑起来。这接近里特费尔德把物体、墙面和空间拆成独立构件的方式。",
    },
    artistMatches: [
      { name: "里特费尔德", score: 86, trait: "空间结构", note: "像一个还没被命名的结构，先把支撑关系亮出来。" },
      { name: "蒙德里安", score: 78, trait: "纯粹秩序", note: "你有清除偶然性的冲动，线条像一套安静的戒律。" },
      { name: "范·杜斯堡", score: 52, trait: "动态宣言", note: "能量存在，但仍被水平与垂直管束着。" },
      { name: "范·德·莱克", score: 64, trait: "色彩自主", note: "色块不是填色，它们像独立站在白色空间中的小型事件。" },
    ],
    dimensions: [
      { label: "秩序", value: 88 },
      { label: "材料", value: 72 },
      { label: "色彩", value: 64 },
      { label: "运动", value: 46 },
      { label: "神秘性", value: 76 },
    ],
    stageCaptions: {
      original: "这里还不是作品，只是一块尚未被命名的现实碎片。",
      stage1: "第一张像蒙德里安的清晨：对象退场，只剩关系接受审判。",
      stage2: "第二张开始像工坊里的里特费尔德，结构长出触感，平面想变成空间。",
      stage3: "第三张把显影的痕迹带回现实，让光线替材料作证。",
    },
    narrative:
      "如果把这张图当作一场人格测试，你的答案不是“像什么”，而是“怎样组织世界”。你接近里特费尔德：相信结构必须诚实地站出来；也带着蒙德里安式的洁癖，试图把偶然从画面里擦掉。色彩在这里不是糖衣，而是空间中的坐标。它们安静，却不服从。",
    quote: "空间不在这里结束，材料只是空间的句号。",
    closing: "你的艺术家人格不是浪漫的涂抹者，而是把现实拆开、再让它重新站立的人。",
  };
}

async function siliconflowJson(url, body) {
  requireKey();
  const response = await fetch(url, {
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

  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return data;
}

async function analyze(req, res) {
  const body = await readBody(req);
  const image = normalizeImageInput(body.imageBase64);
  const data = await siliconflowJson("https://api.siliconflow.cn/v1/chat/completions", {
    model: visionModel,
    messages: [
      {
        role: "system",
        content: "你只输出严格 JSON。你擅长从抽象图像中提取语义并转写为图像生成提示词。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: buildVisionPrompt() },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    stream: false,
    max_tokens: 2048,
    temperature: 0.82,
    top_p: 0.9,
    response_format: { type: "json_object" },
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("视觉模型没有返回内容");

  try {
    sendJson(res, 200, JSON.parse(normalizeJsonText(content)));
  } catch {
    sendJson(res, 200, fallbackAnalysis());
  }
}

function buildImagePrompt(prompt, title) {
  return `${title}
你正在执行“抽象艺术创作流程逆推”任务。输入文本是一份从同一张抽象终稿中提取出的统一语义说明书。你的任务不是自由创作新对象，而是在保留核心构图逻辑的前提下，生成该对象在更早创作阶段的对应图像。必须保持对象类别、画面重心、比例节奏、留白分布、主要色块关系和主要方向关系的一致性，只改变抽象程度与表现方式。

硬性约束：
1. 必须从语义说明书中的 selected_source、element_mapping、prompt_base、must_preserve 出发。
2. 生成结果必须能看出与原始抽象图之间的构图对应关系，不能生成一个无关的新物体或新场景。
3. 画面里绝对不能出现任何文字、字母、数字、符号、标牌、说明标签、签名、水印、logo。
4. 不要积木、乐高、玩具砖、拼装玩具或儿童玩具。
5. 不要默认生成椅子、红蓝椅、家具或室内设计物；只有当语义说明书的 selected_source 明确选择这类对象时才可以生成。

${prompt}

画面要求：4:3 横构图，展览级审美，构图清晰。纯图像，无文字，无字母，无数字，无符号，无标牌，无签名，无水印，无 UI，无边框。`;
}

async function generateOne(prompt, title) {
  const data = await siliconflowJson("https://api.siliconflow.cn/v1/images/generations", {
    model: imageModel,
    prompt: buildImagePrompt(prompt, title),
    negative_prompt:
      "text, letters, numbers, symbols, typography, handwriting, caption, label, sign, signage, watermark, logo, signature, UI, interface, frame, border, lego, building blocks, toy bricks, toy, default chair, chair, red blue chair, furniture, unrelated object, unrelated scene, blurry, low quality, bad anatomy",
    image_size: "1024x768",
    batch_size: 1,
    num_inference_steps: 20,
    guidance_scale: 7.5,
  });

  const result = data.images?.[0] || data.data?.[0];
  if (!result?.url && !result?.b64_json) throw new Error("生图模型没有返回图片");
  if (result.b64_json) return `data:image/png;base64,${result.b64_json}`;
  return result.url;
}

function stagesFromPrompts(prompts = {}) {
  return [
    {
      title: "第3张：对象化色面图",
      prompt: prompts.stage_3_objectified_color_image || prompts.stage3 || fallbackAnalysis().stagePrompts.stage_3_objectified_color_image,
    },
    {
      title: "第2张：结构草图",
      prompt: prompts.stage_2_structural_sketch || prompts.stage2 || fallbackAnalysis().stagePrompts.stage_2_structural_sketch,
    },
    {
      title: "第1张：具象素描",
      prompt: prompts.stage_1_representational_sketch || prompts.stage1 || fallbackAnalysis().stagePrompts.stage_1_representational_sketch,
    },
  ];
}

async function generateStages(req, res) {
  const body = await readBody(req);
  const images = [];
  for (const stage of stagesFromPrompts(body.stagePrompts)) {
    const imageBase64 = await generateOne(stage.prompt, stage.title);
    images.push({ title: stage.title, imageBase64 });
  }
  sendJson(res, 200, { images });
}

async function generateStage(req, res) {
  const body = await readBody(req);
  const title = body.title || "第3张：对象化色面图";
  const prompt = body.prompt || fallbackAnalysis().stagePrompts.stage_3_objectified_color_image;
  const imageBase64 = await generateOne(prompt, title);
  sendJson(res, 200, { title, imageBase64 });
}

function buildReportPrompt(analysis, stages) {
  return `
请为一个“从抽象图到真实世界”的交互展示生成一份中文艺术家人格测试报告。

视觉分析：
${JSON.stringify(analysis, null, 2)}

生成链路：
${JSON.stringify(stages, null, 2)}

要求：
1. 报告要像“测出你是哪一个艺术家了”的 MBTI 报告，不要像普通策展说明。
2. 语言要有艺术性、幽默感、人格洞察和画面感，可以犀利一点，但不要空泛。
3. 必须从以下四位风格派相关艺术家中选择主型和副型：皮特·蒙德里安、特奥·范·杜斯堡、赫里特·里特费尔德、巴特·范·德·莱克。
4. 明确写出流程是：第4张抽象终稿 -> 中间语义说明书 -> 第3张对象化色面图 -> 第2张结构草图 -> 第1张具象素描。注意后三张图不是继续看图生成，而是都基于同一份中间语义说明书进行三次不同抽象程度的转译。
5. 不要出现积木、乐高、玩具砖、拼装玩具等解释。
6. 不要编造模型技术细节，不要说自己看不到图片。
4. 严格返回 JSON，不要 Markdown。

艺术家参考：
- 蒙德里安：禁欲、内省、追求纯粹关系、水平线和垂直线、三原色、神智学、排除自然偶然性。典型语气：“你看到的不是颜色，是关系。”
- 范·杜斯堡：激进组织者，风格派传播者，提出元素主义和斜线，热爱建筑、机器、钢铁玻璃混凝土，认为线、色彩、平面比自然对象更具体。
- 里特费尔德：沉默精准的手艺人与建筑家具设计者，红蓝椅、施罗德住宅，强调结构诚实、材料如实呈现、空间由物体决定。
- 范·德·莱克：固执独行的色彩派，染色玻璃与纺织背景，强调白色不是空，色彩不应被黑线监禁，色块是自由个体。

JSON 字段：
{
  "title": "艺术家人格报告标题，例如：你是里特费尔德型空间炼金术师",
  "subtitle": "一句有趣副标题",
  "artistType": "主艺术家-副艺术家，例如 Rietveld-Mondrian",
  "matchPercent": 0-100,
  "mbti": {
    "code": "四字母人格代号，可以原创但要像 MBTI",
    "name": "中文人格名",
    "summary": "80 字以内的人格总结"
  },
  "primaryArtist": {
    "name": "主艺术家中文名",
    "reason": "为什么测出这个艺术家，80 字以内"
  },
  "artistMatches": [
    { "name": "蒙德里安", "score": 0-100, "trait": "核心特质", "note": "一句尖锐有趣的判断" },
    { "name": "范·杜斯堡", "score": 0-100, "trait": "核心特质", "note": "一句尖锐有趣的判断" },
    { "name": "里特费尔德", "score": 0-100, "trait": "核心特质", "note": "一句尖锐有趣的判断" },
    { "name": "范·德·莱克", "score": 0-100, "trait": "核心特质", "note": "一句尖锐有趣的判断" }
  ],
  "dimensions": [
    { "label": "秩序", "value": 0-100 },
    { "label": "材料", "value": 0-100 },
    { "label": "色彩", "value": 0-100 },
    { "label": "运动", "value": 0-100 },
    { "label": "神秘性", "value": 0-100 }
  ],
  "stageCaptions": {
    "original": "第4张抽象终稿艺术化说明",
    "stage3": "第3张对象化色面图说明，强调它来自统一语义说明书",
    "stage2": "第2张结构草图说明，强调它来自同一份语义说明书",
    "stage1": "第1张具象素描说明，强调它来自同一份语义说明书"
  },
  "narrative": "一段 140-220 字的完整人格解读，必须具体、有趣、有艺术史气味",
  "quote": "一句像这个人格会说的话",
  "closing": "最后一句耐人寻味的话"
}`;
}

async function report(req, res) {
  const body = await readBody(req);
  const analysis = body.analysis || fallbackAnalysis();
  const stages = body.stages || [];
  const data = await siliconflowJson("https://api.siliconflow.cn/v1/chat/completions", {
    model: reportModel,
    messages: [
      {
        role: "system",
        content: "你是一位会写展览墙文、艺术评论和交互体验说明的中文策展人。你只输出严格 JSON。",
      },
      { role: "user", content: buildReportPrompt(analysis, stages) },
    ],
    stream: false,
    max_tokens: 2048,
    temperature: 0.78,
    top_p: 0.9,
    response_format: { type: "json_object" },
  });

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 报告模型没有返回内容");

  try {
    sendJson(res, 200, JSON.parse(normalizeJsonText(content)));
  } catch {
    sendJson(res, 200, fallbackReport(analysis));
  }
}

async function testImage(req, res) {
  const body = await readBody(req);
  const prompts = body.stagePrompts || fallbackAnalysis().stagePrompts;
  const imageBase64 = await generateOne(
    prompts.stage_3_objectified_color_image || prompts.stage3 || fallbackAnalysis().stagePrompts.stage_3_objectified_color_image,
    "第3张：对象化色面图测试",
  );
  sendJson(res, 200, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === ".css") return "text/css";
  if (ext === ".js") return "text/javascript";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "text/html";
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  const filePath = urlPath === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, urlPath);
  const relative = path.relative(publicDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": `${contentType(filePath)}; charset=utf-8` });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze") return await analyze(req, res);
    if (req.method === "POST" && req.url === "/api/generate-stage") return await generateStage(req, res);
    if (req.method === "POST" && req.url === "/api/generate-stages") return await generateStages(req, res);
    if (req.method === "POST" && req.url === "/api/report") return await report(req, res);
    if (req.method === "POST" && req.url === "/api/test-image") return await testImage(req, res);
    return serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "服务器错误" });
  }
});

server.listen(port, () => {
  console.log(`Static app running at http://localhost:${port}`);
  console.log(`Vision model: ${visionModel}`);
  console.log(`Report model: ${reportModel}`);
  console.log(`Image model: ${imageModel}`);
});
