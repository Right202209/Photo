const B2_API_URL = 'https://api.backblazeb2.com';
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

let authCache = {
  token: null,
  expiresAt: 0,
  downloadUrl: null,
  bucketName: null
};

function getRequiredEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required Worker environment variable: ${key}`);
  }
  return value;
}

function toBase64(value) {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  return Buffer.from(value, 'utf-8').toString('base64');
}

async function readResponseText(response) {
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

function isAllowedObjectKey(key) {
  return key.startsWith('images/') || key.startsWith('thumbnails/');
}

function getObjectKeyFromPath(pathname) {
  return pathname.replace(/^\/+/, '');
}

async function authorizeB2(env) {
  const keyId = getRequiredEnv(env, 'B2_KEY_ID');
  const appKey = getRequiredEnv(env, 'B2_APPLICATION_KEY');
  const bucketName = getRequiredEnv(env, 'B2_BUCKET_NAME');

  const basic = toBase64(`${keyId}:${appKey}`);
  const response = await fetch(`${B2_API_URL}/b2api/v2/b2_authorize_account`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basic}`
    }
  });

  if (!response.ok) {
    throw new Error(`B2 authorization failed: ${await readResponseText(response)}`);
  }

  const payload = await response.json();
  const validDurationMs = Number(payload.authorizationTokenDurationSeconds || 86400) * 1000;

  authCache = {
    token: payload.authorizationToken,
    expiresAt: Date.now() + validDurationMs - TOKEN_REFRESH_BUFFER_MS,
    downloadUrl: payload.apiInfo.storageApi.downloadUrl,
    bucketName
  };

  return authCache;
}

async function getB2Auth(env) {
  if (authCache.token && Date.now() < authCache.expiresAt) {
    return authCache;
  }

  return authorizeB2(env);
}

function withCorsHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function getErrorStatus(status) {
  if (status === 401 || status === 403) {
    return 403;
  }

  if (status === 404) {
    return 404;
  }

  return 502;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const objectKey = getObjectKeyFromPath(url.pathname);

    if (!objectKey || !isAllowedObjectKey(objectKey)) {
      return new Response('Not Found', { status: 404 });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);

    if (cached) {
      return withCorsHeaders(cached);
    }

    try {
      const auth = await getB2Auth(env);
      const encodedFileName = objectKey.split('/').map(encodeURIComponent).join('/');
      const b2Url = `${auth.downloadUrl}/file/${encodeURIComponent(auth.bucketName)}/${encodedFileName}`;

      const upstream = await fetch(b2Url, {
        method: request.method,
        headers: {
          Authorization: auth.token
        }
      });

      if (!upstream.ok) {
        const status = getErrorStatus(upstream.status);
        const message = status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : 'Bad Gateway';
        return new Response(message, { status });
      }

      const headers = new Headers(upstream.headers);
      if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', 'public, max-age=3600');
      }

      const response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });

      if (request.method === 'GET') {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return withCorsHeaders(response);
    } catch (error) {
      return new Response(`Worker error: ${error.message || error}`, { status: 500 });
    }
  }
};
