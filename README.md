# 抽象语义生成实验

这是一个简洁的前端 + Node 后端项目，用于交互展示：

1. 用户拍摄或上传一张 4:3 图片。
2. 视觉模型 `Pro/moonshotai/Kimi-K2.6` 提取画面语义。
3. 文生图模型 `Tongyi-MAI/Z-Image-Turbo` 生成三张图：高度抽象、半抽象绘画、写实还原。

旧 Next 项目已移动到 `legacy-next-app/`。

## 项目结构

```text
public/
  index.html
  styles.css
  app.js
server.js
package.json
legacy-next-app/
```

## 启动

```bash
npm start
```

访问：

```text
http://localhost:3000
```

## API Key

后端会优先读取环境变量：

```bash
SILICONFLOW_API_KEY=你的key node server.js
```

如果没有环境变量，会继续读取：

```text
legacy-next-app/.env.local
```

可选模型变量：

```text
SILICONFLOW_VISION_MODEL=Pro/moonshotai/Kimi-K2.6
SILICONFLOW_IMAGE_MODEL=Tongyi-MAI/Z-Image-Turbo
```
