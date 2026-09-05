import edgeV2 from './index-v2.js';

const RETRYABLE = new Set([429, 500, 502, 503]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function rebuildRequest(request, body) {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: body ? body.slice(0) : undefined
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isFlightSearch = request.method === 'POST' && url.pathname === '/rpc/searchWorldwideFlights';
    if (!isFlightSearch || !env.SCRAPPA_API_KEY) return edgeV2.fetch(request, env, ctx);

    const body = await request.arrayBuffer();
    let lastResponse = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      lastResponse = await edgeV2.fetch(rebuildRequest(request, body), env, ctx);
      if (!RETRYABLE.has(lastResponse.status)) return lastResponse;
      if (attempt < 2) await sleep(800 * (2 ** attempt));
    }
    return lastResponse;
  }
};
