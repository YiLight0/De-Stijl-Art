const { editImage, sendOk, sendError } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const title = body.title || "图生图倒推";
    const prompt =
      body.prompt ||
      "根据用户作品进行风格派倒推图生图。保留原图构图关系、重心、比例和空间节奏，生成阶段性推演图，绝对无文字。";
    const imageBase64 = await editImage(body.imageBase64, prompt, title);
    sendOk(res, { title, imageBase64 });
  } catch (error) {
    sendError(res, error);
  }
};
