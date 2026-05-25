const { analyzeImage, sendOk, sendError } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const analysis = await analyzeImage(body.imageBase64);
    sendOk(res, analysis);
  } catch (error) {
    sendError(res, error);
  }
};
