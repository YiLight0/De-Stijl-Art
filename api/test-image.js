const { editImage, sendOk, sendError, imageModel } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const prompts = body.stagePrompts || {};
    const prompt =
      prompts.stage_2_structural_sketch ||
      prompts.stage_1_representational_sketch ||
      "请根据用户作品生成一张黑白结构草图，保留原图构图关系、重心、比例和方向，绝对无文字。";
    const imageBase64 = await editImage(body.imageBase64, prompt, "图生图测试");
    sendOk(res, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
  } catch (error) {
    sendError(res, error);
  }
};
