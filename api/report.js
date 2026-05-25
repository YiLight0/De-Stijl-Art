const { buildReport, sendOk, sendError } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const report = await buildReport(body.analysis || {}, body.stages || []);
    sendOk(res, report);
  } catch (error) {
    sendError(res, error);
  }
};
