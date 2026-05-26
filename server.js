const http = require("http");
const fs = require("fs");
const path = require("path");
const { analyzeImage, generateImage, buildReport, sendOk, sendError, imageModel } = require("./api/_lib");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);

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
    if (req.method === "POST" && req.url === "/api/analyze") {
      const body = await readBody(req);
      return sendOk(res, await analyzeImage(body.imageBase64));
    }
    if (req.method === "POST" && req.url === "/api/generate-stage") {
      const body = await readBody(req);
      const title = body.title || "生成图";
      const prompt = body.prompt || "抽象艺术创作流程逆推图像，4:3 横构图，绝对无文字。";
      return sendOk(res, { title, imageBase64: await generateImage(prompt, title) });
    }
    if (req.method === "POST" && req.url === "/api/report") {
      const body = await readBody(req);
      return sendOk(res, await buildReport(body.analysis || {}, body.stages || []));
    }
    if (req.method === "POST" && req.url === "/api/test-image") {
      const body = await readBody(req);
      const prompts = body.stagePrompts || {};
      const prompt =
        prompts.stage_3_objectified_color_image ||
        prompts.stage3 ||
        "对象化色面图，基于抽象图语义生成，4:3 横构图，绝对无文字。";
      const imageBase64 = await generateImage(prompt, "第3张：对象化色面图测试");
      return sendOk(res, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
    }
    return serveStatic(req, res);
  } catch (error) {
    return sendError(res, error);
  }
});

server.listen(port, () => {
  console.log(`Static app running at http://localhost:${port}`);
  console.log("API provider: OpenAI");
});
