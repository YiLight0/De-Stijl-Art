const { generateImage, sendOk, sendError, imageModel } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const prompts = body.stagePrompts || {};
    const prompt =
      prompts.stage_3_objectified_color_image ||
      prompts.stage3 ||
      "对象化色面图，基于抽象图语义生成，4:3 横构图，绝对无文字。";
    const imageBase64 = await generateImage(prompt, "第3张：对象化色面图测试");
    sendOk(res, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
  } catch (error) {
    sendError(res, error);
  }
};
