const fs = require('fs-extra');
const path = require('path');

const SRC_DIR = 'src/images';
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node scripts/add.js <path-to-image1> <path-to-image2> ...');
    process.exit(1);
}

async function addImages() {
    await fs.ensureDir(SRC_DIR);

    for (const sourcePath of args) {
        try {
            const filename = path.basename(sourcePath);
            const destPath = path.join(SRC_DIR, filename);

            if (await fs.pathExists(destPath)) {
                console.warn(`Warning: ${filename} already exists in src/images. Skipping.`);
                continue;
            }

            await fs.copy(sourcePath, destPath);
            console.log(`Added ${filename} to src/images`);
        } catch (err) {
            console.error(`Error adding ${sourcePath}:`, err.message);
        }
    }

    console.log('\nDone! Run "npm run build" to update the gallery.');
}

addImages().catch(console.error);
