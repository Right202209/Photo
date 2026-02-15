const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');

const B2_API_URL = 'https://api.backblazeb2.com';
const PUBLIC_DIR = 'public';
const DEFAULT_CACHE_CONTROL = process.env.B2_CACHE_CONTROL || 'public,max-age=31536000,immutable';

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function readErrorMessage(response) {
    const text = await response.text();
    if (!text) {
        return `HTTP ${response.status}`;
    }

    try {
        const payload = JSON.parse(text);
        return payload.message || payload.code || text;
    } catch {
        return text;
    }
}

function encodeB2FileName(fileName) {
    return encodeURIComponent(fileName).replace(/%2F/g, '/');
}

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

function getContentTypeByKey(objectKey) {
    if (objectKey.startsWith('images/') || objectKey.startsWith('thumbnails/')) {
        // scripts/build.js converts gallery outputs to JPEG
        return 'image/jpeg';
    }

    return 'application/octet-stream';
}

async function authorizeAccount(keyId, applicationKey) {
    const basicToken = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');

    const response = await fetch(`${B2_API_URL}/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${basicToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to authorize B2 account: ${await readErrorMessage(response)}`);
    }

    return response.json();
}

async function getUploadUrl(apiUrl, authorizationToken, bucketId) {
    const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: authorizationToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId })
    });

    if (!response.ok) {
        throw new Error(`Failed to get B2 upload URL: ${await readErrorMessage(response)}`);
    }

    return response.json();
}

async function uploadFile(uploadUrl, uploadAuthToken, objectKey, filePath, cacheControl) {
    const fileBuffer = await fs.readFile(filePath);
    const contentSha1 = crypto.createHash('sha1').update(fileBuffer).digest('hex');

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: uploadAuthToken,
            'X-Bz-File-Name': encodeB2FileName(objectKey),
            'Content-Type': getContentTypeByKey(objectKey),
            'Content-Length': String(fileBuffer.length),
            'X-Bz-Content-Sha1': contentSha1,
            'X-Bz-Info-b2-cache-control': cacheControl
        },
        body: fileBuffer
    });

    if (!response.ok) {
        throw new Error(`Upload failed for ${objectKey}: ${await readErrorMessage(response)}`);
    }

    return response.json();
}

function collectUploadTargets() {
    const images = glob.sync('images/**/*', { cwd: PUBLIC_DIR, nodir: true });
    const thumbnails = glob.sync('thumbnails/**/*', { cwd: PUBLIC_DIR, nodir: true });
    const keys = [...images, ...thumbnails];

    return keys.map((key) => {
        const objectKey = toPosixPath(key);
        return {
            objectKey,
            filePath: path.join(PUBLIC_DIR, key)
        };
    });
}

async function main() {
    const keyId = getRequiredEnv('B2_KEY_ID');
    const applicationKey = getRequiredEnv('B2_APPLICATION_KEY');
    const bucketId = getRequiredEnv('B2_BUCKET_ID');
    const cacheControl = DEFAULT_CACHE_CONTROL;

    const uploadTargets = collectUploadTargets();

    if (uploadTargets.length === 0) {
        console.log('No files found in public/images or public/thumbnails. Run npm run build first.');
        return;
    }

    console.log(`Preparing to upload ${uploadTargets.length} files to B2 bucket ${bucketId}.`);

    const auth = await authorizeAccount(keyId, applicationKey);
    const uploadConfig = await getUploadUrl(auth.apiInfo.storageApi.apiUrl, auth.authorizationToken, bucketId);

    let uploadedCount = 0;

    for (const target of uploadTargets) {
        await uploadFile(uploadConfig.uploadUrl, uploadConfig.authorizationToken, target.objectKey, target.filePath, cacheControl);
        uploadedCount += 1;
        console.log(`[${uploadedCount}/${uploadTargets.length}] Uploaded ${target.objectKey}`);
    }

    console.log('B2 upload complete.');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
