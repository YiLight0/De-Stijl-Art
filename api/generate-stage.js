const { generateImage, sendOk, sendError } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const title = body.title || "生成图";
    const prompt = body.prompt || "抽象艺术创作流程逆推图像，4:3 横构图，绝对无文字。";
    const imageBase64 = await generateImage(prompt, title);
    sendOk(res, { title, imageBase64 });
  } catch (error) {
    sendError(res, error);
  }
};
