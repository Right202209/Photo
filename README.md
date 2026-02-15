# Personal Photo Gallery

A simple, elegant, and responsive personal photo gallery.

## Features

- **Automatic Image Optimization**: Resizes and compresses images for web display.
- **Responsive Waterfall Layout**: Adapts to different screen sizes using CSS columns.
- **Smooth Animations**: Fade-in effects and smooth transitions.
- **Image Zoom**: Uses PhotoSwipe for a rich lightbox experience with zoom and touch gestures.
- **Simple Management**: Just add images to `src/images` and rebuild.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Add Images**:
    Place your photos in `src/images`. Supported formats: JPG, PNG, WebP.

3.  **Build the Gallery**:
    ```bash
    npm run build
    ```
    This will process images and generate the `public` folder.

4.  **Development Mode**:
    ```bash
    npm run dev
    ```
    This will start a local server and watch for changes in `src`.

## Deployment

The `public` folder contains the static site. You can deploy it to GitHub Pages, Vercel, Netlify, or any static hosting service.

## Backblaze B2（私有桶）+ Cloudflare Worker（中文配置）

> 目标：页面与 `data.json` 仍部署到 GitHub Pages；原图与缩略图存放到 **B2 私有桶**；前端通过 **Cloudflare Worker 代理**读取图片。

### 1) 创建 B2 私有桶

1. 在 Backblaze B2 控制台创建 bucket。
2. Bucket Type 选择 **Private**。
3. 记录：
   - `B2_BUCKET_ID`
   - `B2_BUCKET_NAME`

### 2) 创建最小权限 App Key

建议创建仅用于本项目上传/读取的 Application Key，并限制到目标 bucket。

建议权限：
- 允许写入文件（上传构建产物）
- 允许读取文件（Worker 回源）

准备以下凭据：
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`

### 3) 本地构建与上传

先安装依赖并构建：

```bash
npm install
GALLERY_STORAGE_MODE=b2-private-proxy \
GALLERY_IMAGE_BASE_URL=https://<your-worker-domain> \
npm run build
```

然后上传构建后的图片到私有桶：

```bash
B2_KEY_ID=... \
B2_APPLICATION_KEY=... \
B2_BUCKET_ID=... \
npm run upload:b2
```

说明：
- 上传脚本会上传 `public/images/**` 与 `public/thumbnails/**`
- 上传 key 分别是 `images/...` 与 `thumbnails/...`
- 默认缓存头：`public,max-age=31536000,immutable`
- 同 key 重传会覆盖，便于 CI 幂等执行

### 4) 部署 Cloudflare Worker 代理

仓库内示例目录：`worker/`

1. 安装 Wrangler（如尚未安装）
2. 修改 `worker/wrangler.toml`：
   - `name`
   - `B2_BUCKET_NAME`
3. 注入 Worker secrets：

```bash
cd worker
wrangler secret put B2_KEY_ID
wrangler secret put B2_APPLICATION_KEY
```

4. 发布 Worker：

```bash
wrangler deploy
```

Worker 路由约定：
- `https://<worker-domain>/images/<file>`
- `https://<worker-domain>/thumbnails/<file>`

前端会在 `storage=b2-private-proxy` 模式下，使用 `imageBaseUrl + originalKey/thumbKey` 拼接访问地址。

### 5) GitHub Actions Secrets 配置

在仓库 Settings → Secrets and variables → Actions 中添加：

- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_ID`
- `GALLERY_IMAGE_BASE_URL`（例如 `https://<worker-domain>`）

当前工作流顺序：
1. `npm run build`（带 `GALLERY_STORAGE_MODE=b2-private-proxy`）
2. `npm run upload:b2`
3. 部署 `public/` 到 GitHub Pages

### 6) 常见问题排查

- **403 Forbidden（Worker）**
  - 检查 Worker secrets 是否已正确设置
  - 检查 App Key 是否有对应 bucket 的读取权限
- **404 Not Found（Worker）**
  - 检查 `data.json` 中的 `originalKey/thumbKey` 是否与 B2 实际对象路径一致
  - 确认已先执行 `npm run build` 再执行 `npm run upload:b2`
- **页面仍加载旧图**
  - 可能是 CDN/浏览器缓存，尝试强制刷新
  - 确认上传后对象 key 是否变化
- **线上图片路径不走 Worker**
  - 检查构建时是否设置 `GALLERY_STORAGE_MODE=b2-private-proxy`
  - 检查 `GALLERY_IMAGE_BASE_URL` 是否为 Worker 域名

## Customization

- **Styles**: Edit `src/style.css` to change the look and feel.
- **Logic**: Edit `src/app.js` for custom behavior.
- **Build Config**: Edit `scripts/build.js` to change image sizes or quality.

## Credits

- [PhotoSwipe](https://photoswipe.com/) for the lightbox.
- [Sharp](https://sharp.pixelplumbing.com/) for image processing.
