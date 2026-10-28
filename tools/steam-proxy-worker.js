// Cloudflare Worker: tiny CORS proxy for collection.html.
//
// Browsers can't read steamcommunity.com directly (Steam sends no CORS headers), so this Worker
// fetches the two public URLs the page needs and returns them with CORS headers added.
// Only Desktop Waifu inventories and profile XML are allowed, so it can't be used as an open proxy.
//
// Deploy: Cloudflare dashboard -> Workers & Pages -> Create -> "Hello World" Worker -> Edit code,
// paste this file, Deploy. Then set CONFIG.proxyUrl in collection.html to the Worker's URL
// (e.g. 'https://dw-steam-proxy.<your-subdomain>.workers.dev').

const APPID = '3702960';
const CACHE_SECONDS = 300; // Steam rate-limits inventory requests; reuse answers for 5 minutes.

const ALLOWED = [
  new RegExp(`^/inventory/\\d{17}/${APPID}/2$`),
  /^\/profiles\/\d{17}\/?$/,
  /^\/id\/[^/]{1,64}\/?$/,
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url'));
    } catch {
      return new Response('Missing or bad ?url=', { status: 400, headers: CORS });
    }
    if (target.protocol !== 'https:' || target.hostname !== 'steamcommunity.com' ||
        !ALLOWED.some((re) => re.test(target.pathname))) {
      return new Response('URL not allowed', { status: 403, headers: CORS });
    }

    const cache = caches.default;
    const cacheKey = new Request(target.toString());
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached);

    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'DesktopWaifuCollection/1.0', 'Accept-Language': 'en' },
    });
    const response = new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/plain',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return withCors(response);
  },
};

function withCors(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}
