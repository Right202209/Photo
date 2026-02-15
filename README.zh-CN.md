# 个人相册

English version: [README.md](README.md)

### 项目简介

这是一个零框架的静态站点相册项目：
- 源图放在 `src/images/`
- 构建后生成 `public/`
- 页面数据来自 `public/data.json`
- 可选将图片存储到 Backblaze B2 私有桶，并通过 Cloudflare Worker 代理访问

### 功能特性

- 自动压缩与尺寸优化（原图最大宽度 `1920`，缩略图宽度 `400`）
- 响应式瀑布流展示
- 懒加载和占位图（blur placeholder）
- PhotoSwipe 预览、缩放、下载
- 本地开发监听 `src/` 变更并自动重建

### 目录结构

```text
src/
  images/        # 你的原始照片
  index.html
  style.css
  app.js
scripts/
  build.js       # 构建 + 生成 data.json
  dev.js         # 开发模式（watch + serve）
  upload-b2.js   # 上传 public/images 与 public/thumbnails 到 B2
worker/
  src/index.js   # Cloudflare Worker 代理
  wrangler.toml
public/          # 构建产物（可直接部署）
```

### 快速开始（本地模式）

1. 安装依赖

```bash
npm install
```

2. 添加照片到 `src/images/`（支持 `jpg/jpeg/png/webp`）

3. 构建

```bash
npm run build
```

4. 本地预览

```bash
npm run start
```

5. 开发模式（监听修改并自动重建）

```bash
npm run dev
```

### 常用命令

- `npm run build`: 生成 `public/`、优化图片、输出 `public/data.json`
- `npm run dev`: watch `src/` + 本地静态服务
- `npm run add -- /path/a.jpg /path/b.png`: 批量复制图片到 `src/images/`
- `npm run upload:b2`: 上传构建后的图片到 B2

### 存储模式说明

`build` 会把存储信息写入 `public/data.json`：

- `local`（默认）: 前端直接读取站点内的 `images/...` 和 `thumbnails/...`
- `b2-private-proxy`: 前端通过 `GALLERY_IMAGE_BASE_URL/<objectKey>` 请求 Worker

构建时可用环境变量：

- `GALLERY_STORAGE_MODE`: `local` 或 `b2-private-proxy`
- `GALLERY_IMAGE_BASE_URL`: Worker 域名，如 `https://photo-b2-proxy.xxx.workers.dev`

### 详细教程：Backblaze B2 私有桶 + Cloudflare Worker

目标：
- GitHub Pages 只部署 HTML/CSS/JS 和 `data.json`
- 原图与缩略图存储在 B2 私有桶
- 浏览器只访问 Worker，不直接访问 B2

#### 1. 创建 B2 私有桶

在 Backblaze B2 控制台：

1. 新建 Bucket
2. Bucket Type 选择 `Private`
3. 记下 Bucket 名称与 ID

你后续会用到：
- `B2_BUCKET_NAME`（给 Worker）
- `B2_BUCKET_ID`（给上传脚本）

#### 2. 创建最小权限 Application Key

建议创建专用 key，并限制到单个 bucket。

至少需要：
- 读取权限（Worker 回源下载）
- 写入权限（CI 或本地上传图片）

拿到：
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`

#### 3. 本地构建（启用代理模式）

在项目根目录执行：

```bash
GALLERY_STORAGE_MODE=b2-private-proxy \
GALLERY_IMAGE_BASE_URL=https://<your-worker-domain> \
npm run build
```

成功后检查 `public/data.json`：
- `storage` 应为 `b2-private-proxy`
- `imageBaseUrl` 应为你的 Worker 域名

#### 4. 上传图片到 B2 私有桶

```bash
B2_KEY_ID=... \
B2_APPLICATION_KEY=... \
B2_BUCKET_ID=... \
npm run upload:b2
```

上传行为：
- 来源目录：`public/images/**`、`public/thumbnails/**`
- 对象 key：`images/...`、`thumbnails/...`
- 默认缓存头：`public,max-age=31536000,immutable`
- 同 key 上传会覆盖，适合 CI 幂等部署

可选缓存头覆盖：

```bash
B2_CACHE_CONTROL='public,max-age=86400' npm run upload:b2
```

#### 5. 配置并部署 Cloudflare Worker

1. 编辑 `worker/wrangler.toml`
   - `name` 改成你的 Worker 名称
   - `[vars]` 中 `B2_BUCKET_NAME` 改成你的私有桶名

2. 注入 secrets（在 `worker/` 目录）

```bash
cd worker
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APPLICATION_KEY
```

3. 发布 Worker

```bash
npx wrangler deploy
```

4. 验证路由

- `https://<worker-domain>/images/<filename>.jpg`
- `https://<worker-domain>/thumbnails/<filename>.jpg`

说明：
- Worker 仅允许访问 `images/` 与 `thumbnails/` 前缀
- 支持 `GET/HEAD/OPTIONS`
- 其他路径会返回 `404`

#### 6. 配置 GitHub Actions 自动部署

在仓库 `Settings -> Secrets and variables -> Actions` 添加：

- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_ID`
- `GALLERY_IMAGE_BASE_URL`（Worker 域名，例如 `https://xxx.workers.dev`）

当前工作流（`.github/workflows/deploy.yml`）顺序：

1. `npm run build`（`GALLERY_STORAGE_MODE=b2-private-proxy`）
2. `npm run upload:b2`
3. 删除 `public/images` 与 `public/thumbnails`
4. 将剩余 `public/` 部署到 GitHub Pages

这意味着：
- Pages 不保存原图与缩略图
- 页面通过 Worker 动态读取 B2 私有图片

#### 7. 上线自检清单

- `public/data.json` 的 `storage` 和 `imageBaseUrl` 正确
- B2 桶中存在 `images/...` 与 `thumbnails/...` 对象
- Worker secrets 已设置且生效
- Worker URL 可以直接打开图片
- GitHub Pages 页面网络请求的图片域名是 Worker 域名

#### 8. 常见问题排查

- 403 Forbidden（Worker 返回）
  - 检查 `B2_KEY_ID/B2_APPLICATION_KEY` 是否正确
  - 检查 key 权限是否包含读取目标 bucket
  - 检查 `B2_BUCKET_NAME` 是否与实际桶名一致

- 404 Not Found（Worker 返回）
  - 检查图片是否已成功上传到 B2
  - 检查 `data.json` 中 key 与 B2 对象路径是否一致
  - 检查访问路径是否以 `/images/` 或 `/thumbnails/` 开头

- 页面图片加载到旧版本
  - 强制刷新浏览器缓存
  - 检查是否上传了新 key（或覆盖后 CDN 缓存尚未过期）

- 页面仍走本地路径而非 Worker
  - 检查构建时是否设置 `GALLERY_STORAGE_MODE=b2-private-proxy`
  - 检查 `GALLERY_IMAGE_BASE_URL` 是否写入 `data.json`

## 致谢

- [PhotoSwipe](https://photoswipe.com/)
- [Sharp](https://sharp.pixelplumbing.com/)

