const { editImage, generateImage, sendOk, sendError } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const title = body.title || "风格派倒推生成";
    const prompt =
      body.prompt ||
      "生成一张风格派倒推推演图，保持无文字、无字母、无数字、无标签。";

    if (body.mode === "quad") {
      const imageBase64 = await generateImage(prompt, title);
      return sendOk(res, { title, imageBase64 });
    }

    const imageBase64 = await editImage(body.imageBase64, prompt, title);
    return sendOk(res, { title, imageBase64 });
  } catch (error) {
    return sendError(res, error);
  }
};
