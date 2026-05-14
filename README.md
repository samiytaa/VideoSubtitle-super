# VideoSubtitle-super

一个基于 `Vite + React` 的视频字幕/截图处理工具。前端可以单独部署为静态站点；AI 聊天和白描 OCR 功能需要额外后端。

## 本地开发

```bash
npm install
npm run dev
```

默认会同时启动：

- 前端：`http://localhost:5173`
- 本地后端：`http://127.0.0.1:3000`

## 部署结构

建议拆成两部分：

1. 前端静态站点
   - 可部署到 GitHub Pages、Vercel、Netlify
2. 后端 OCR/API 服务
   - 目录：`integrated/web2api`
   - 建议部署到 Render、Railway、Fly.io 或你自己的服务器

## 前端环境变量

前端上线时，如果需要启用 AI/OCR 相关功能，请配置：

```bash
VITE_BACKEND_URL=https://your-backend-domain.com
```

未配置时：

- 浏览器访问线上站点会默认请求当前域名下的 `/api`、`/v1`、`/ocr`
- `file://` 打开的本地包会默认请求 `http://127.0.0.1:3000`

## GitHub Pages

这个项目已经切换为 hash 路由，适合直接部署到 GitHub Pages，无需额外配置重写规则。

推荐流程：

```bash
npm run build
```

将 `dist/` 发布到 GitHub Pages 即可。

## 功能边界

这些功能可以纯前端运行：

- 视频上传
- ROI 选区
- 截帧
- 拼图
- 文本整理

这些功能需要后端：

- 白描 OCR
- 站内 AI 聊天
- 任何 `/api`、`/v1`、`/ocr` 请求
