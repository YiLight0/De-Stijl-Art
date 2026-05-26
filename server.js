const http = require("http");
const fs = require("fs");
const path = require("path");
const { analyzeImage, editImage, buildReport, sendOk, sendError, imageModel } = require("./api/_lib");

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
      const title = body.title || "图生图倒推";
      const prompt =
        body.prompt ||
        "根据用户作品进行风格派倒推图生图。保留原图构图关系、重心、比例和空间节奏，生成阶段性推演图，绝对无文字。";
      const imageBase64 = await editImage(body.imageBase64, prompt, title);
      return sendOk(res, { title, imageBase64 });
    }

    if (req.method === "POST" && req.url === "/api/report") {
      const body = await readBody(req);
      return sendOk(res, await buildReport(body.analysis || {}, body.stages || []));
    }

    if (req.method === "POST" && req.url === "/api/test-image") {
      const body = await readBody(req);
      const prompts = body.stagePrompts || {};
      const prompt =
        prompts.stage_2_structural_sketch ||
        prompts.stage_1_representational_sketch ||
        "请根据用户作品生成一张黑白结构草图，保留原图构图关系、重心、比例和方向，绝对无文字。";
      const imageBase64 = await editImage(body.imageBase64, prompt, "图生图测试");
      return sendOk(res, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendError(res, error);
  }
});

server.listen(port, () => {
  console.log(`Static app running at http://localhost:${port}`);
  console.log("API provider: OpenAI image edits");
});
