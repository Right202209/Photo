const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

const SRC_DIR = 'src/images';
const PUBLIC_DIR = 'public/images';
const THUMB_DIR = 'public/thumbnails';
const DATA_FILE = 'public/data.json';

const THUMB_WIDTH = 400; // Thumbnail width
const MAX_WIDTH = 1920; // Max width for full images
const QUALITY = 80; // JPEG quality
const STORAGE_MODE = process.env.GALLERY_STORAGE_MODE || 'local';
const IMAGE_BASE_URL = (process.env.GALLERY_IMAGE_BASE_URL || '').replace(/\/+$/, '');

async function processImages() {
    await fs.ensureDir(PUBLIC_DIR);
    await fs.ensureDir(THUMB_DIR);

    const files = glob.sync(`${SRC_DIR}/**/*.{jpg,jpeg,png,webp}`);
    const imageData = [];

    console.log(`Found ${files.length} images.`);

    for (const file of files) {
        const filename = path.basename(file);
        const publicPath = path.join(PUBLIC_DIR, filename);
        const thumbPath = path.join(THUMB_DIR, filename);

        // Check if file exists and is newer
        const srcStat = await fs.stat(file);
        let processFile = true;

        if (await fs.pathExists(publicPath)) {
            const destStat = await fs.stat(publicPath);
            if (destStat.mtime > srcStat.mtime) {
                processFile = false;
            }
        }

        const metadata = await sharp(file).metadata();

        if (processFile) {
            console.log(`Processing ${filename}...`);

            // Optimize full image
            await sharp(file)
                .resize({ width: MAX_WIDTH, withoutEnlargement: true })
                .jpeg({ quality: QUALITY, mozjpeg: true })
                .toFile(publicPath);

            // Create thumbnail
            await sharp(file)
                .resize({ width: THUMB_WIDTH })
                .jpeg({ quality: 70, mozjpeg: true })
                .toFile(thumbPath);
        }

        // Get dominant color and tiny placeholder
        const pipeline = sharp(file);
        const stats = await pipeline.stats();
        const dominant = stats.dominant;
        const color = `rgb(${dominant.r},${dominant.g},${dominant.b})`;

        const placeholder = await pipeline
            .resize(20)
            .blur(5)
            .toBuffer()
            .then(buf => `data:image/${metadata.format};base64,${buf.toString('base64')}`);

        // Add to data
        let width = metadata.width;
        let height = metadata.height;

        if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
        }

        const originalKey = `images/${filename}`;
        const thumbKey = `thumbnails/${filename}`;

        imageData.push({
            src: originalKey,
            thumb: thumbKey,
            originalKey,
            thumbKey,
            placeholder: placeholder,
            color: color,
            width: width,
            height: height,
            aspectRatio: width / height,
            alt: filename
        });
    }

    // Sort by filename or date if needed (currently just file system order)
    imageData.reverse();

    const dataPayload = {
        storage: STORAGE_MODE,
        imageBaseUrl: IMAGE_BASE_URL,
        images: imageData
    };

    await fs.writeJson(DATA_FILE, dataPayload, { spaces: 2 });
    console.log(`Data written to ${DATA_FILE}`);

    // Copy static assets
    console.log('Copying static assets...');
    await fs.copy('src/index.html', 'public/index.html');
    await fs.copy('src/style.css', 'public/style.css');
    await fs.copy('src/app.js', 'public/app.js');
    console.log('Build complete!');
}

processImages().catch(console.error);
