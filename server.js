const http = require("http");
const fs = require("fs");
const path = require("path");
const { analyzeImage, editImage, generateImage, buildReport, sendOk, sendError, imageModel } = require("./api/_lib");

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
      const title = body.title || "风格派倒推生成";
      const prompt = body.prompt || "生成一张无文字的风格派倒推推演图。";
      const imageBase64 =
        body.mode === "quad"
          ? await generateImage(prompt, title)
          : await editImage(body.imageBase64, prompt, title);
      return sendOk(res, { title, imageBase64 });
    }

    if (req.method === "POST" && req.url === "/api/report") {
      const body = await readBody(req);
      return sendOk(res, await buildReport(body.analysis || {}, body.stages || []));
    }

    if (req.method === "POST" && req.url === "/api/test-image") {
      const body = await readBody(req);
      const imageBase64 = await generateImage(
        "Generate a clean 2 by 2 De Stijl reverse-analysis worksheet. No text, no letters, no numbers.",
        "四宫格测试",
      );
      return sendOk(res, { imageCount: imageBase64 ? 1 : 0, model: imageModel });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendError(res, error);
  }
});

server.listen(port, () => {
  console.log(`Static app running at http://localhost:${port}`);
  console.log("API provider: OpenAI image generations + edits");
});
