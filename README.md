# Personal Photo Gallery

中文文档: [README.zh-CN.md](README.zh-CN.md)

### Overview

This project is a framework-free static photo gallery:
- Put source images in `src/images/`
- Build outputs to `public/`
- Gallery metadata is generated into `public/data.json`
- Optional private image hosting with Backblaze B2 + Cloudflare Worker proxy

### Features

- Automatic image optimization (full image max width `1920`, thumbnail width `400`)
- Responsive masonry-style layout
- Lazy loading with blurred placeholders
- PhotoSwipe lightbox with zoom and download
- Watch mode for local development

### Quick Start (Local Mode)

```bash
npm install
npm run build
npm run start
```

Development watch mode:

```bash
npm run dev
```

### Scripts

- `npm run build`: optimize images and generate `public/data.json`
- `npm run dev`: watch `src/` and serve `public/`
- `npm run add -- /path/a.jpg /path/b.png`: copy files to `src/images/`
- `npm run upload:b2`: upload `public/images` and `public/thumbnails` to B2

### Storage Modes

Build output (`public/data.json`) includes:

- `local` (default): load images from local static paths
- `b2-private-proxy`: load images via `GALLERY_IMAGE_BASE_URL/<objectKey>`

Build-time environment variables:

- `GALLERY_STORAGE_MODE`: `local` or `b2-private-proxy`
- `GALLERY_IMAGE_BASE_URL`: Worker base URL

### Detailed Guide: Backblaze B2 Private Bucket + Cloudflare Worker

#### 1. Create a private B2 bucket

Create a bucket in Backblaze B2 and set Bucket Type to `Private`.

Keep both values:
- `B2_BUCKET_NAME` (used by Worker)
- `B2_BUCKET_ID` (used by upload script)

#### 2. Create a least-privilege Application Key

Create a dedicated key scoped to this bucket with:
- Read permission (Worker fetch)
- Write permission (upload pipeline)

You need:
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`

#### 3. Build with proxy mode enabled

```bash
GALLERY_STORAGE_MODE=b2-private-proxy \
GALLERY_IMAGE_BASE_URL=https://<your-worker-domain> \
npm run build
```

Verify `public/data.json`:
- `storage` is `b2-private-proxy`
- `imageBaseUrl` matches your Worker URL

#### 4. Upload generated images to B2

```bash
B2_KEY_ID=... \
B2_APPLICATION_KEY=... \
B2_BUCKET_ID=... \
npm run upload:b2
```

Behavior:
- Uploads from `public/images/**` and `public/thumbnails/**`
- Uses keys under `images/...` and `thumbnails/...`
- Default cache control: `public,max-age=31536000,immutable`

Optional cache override:

```bash
B2_CACHE_CONTROL='public,max-age=86400' npm run upload:b2
```

#### 5. Configure and deploy Cloudflare Worker

Edit `worker/wrangler.toml`:
- Set `name`
- Set `[vars].B2_BUCKET_NAME`

Set Worker secrets from `worker/`:

```bash
cd worker
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APPLICATION_KEY
npx wrangler deploy
```

Validate endpoints:
- `https://<worker-domain>/images/<filename>.jpg`
- `https://<worker-domain>/thumbnails/<filename>.jpg`

#### 6. Configure GitHub Actions secrets

Add these repo secrets:
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_ID`
- `GALLERY_IMAGE_BASE_URL`

Current workflow (`.github/workflows/deploy.yml`) does:
1. Build with `b2-private-proxy`
2. Upload images to B2
3. Remove `public/images` and `public/thumbnails`
4. Deploy remaining `public/` to GitHub Pages

#### 7. Troubleshooting

- `403` from Worker: wrong secrets, missing bucket read permission, or wrong `B2_BUCKET_NAME`
- `404` from Worker: files not uploaded, wrong object keys, or invalid path prefix
- Old images still shown: browser/CDN cache not refreshed
- Site still loading local image paths: build was not run with `b2-private-proxy`

## Credits

- [PhotoSwipe](https://photoswipe.com/)
- [Sharp](https://sharp.pixelplumbing.com/)
