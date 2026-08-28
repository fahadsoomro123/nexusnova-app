import { writeFile } from 'node:fs/promises';

const TARGET = 15000;
const startedAt = new Date().toISOString();

async function getJson(url, init = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'NexusNova-5.7-public-catalog-scan', Accept: 'application/json', ...(init.headers || {}) } });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error(`${res.status} ${String(data?.error?.message || data?.message || text).slice(0, 220)}`);
    return { data, headers: res.headers };
  } finally { clearTimeout(timer); }
}

function nextLink(headers) {
  const link = headers.get('link') || '';
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (m) return m[1];
  }
  return null;
}

async function scanHuggingFace() {
  const rows = [];
  let url = 'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100&full=true';
  let pages = 0;
  while (url && rows.length < TARGET) {
    const { data, headers } = await getJson(url, {}, 15000);
    const list = Array.isArray(data) ? data : [];
    if (!list.length) break;
    for (const row of list) {
      rows.push({
        source: 'HuggingFace Hub',
        id: String(row?.id || row?.modelId || ''),
        pipeline: String(row?.pipeline_tag || ''),
        downloads: Number(row?.downloads || 0),
        likes: Number(row?.likes || 0),
        gated: Boolean(row?.gated),
        private: Boolean(row?.private),
        tags: Array.isArray(row?.tags) ? row.tags.slice(0, 20) : []
      });
      if (rows.length >= TARGET) break;
    }
    pages += 1;
    url = nextLink(headers);
    if (!url && list.length === 100 && rows.length < TARGET) {
      const last = encodeURIComponent(String(list.at(-1)?.id || ''));
      if (!last) break;
      url = `https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100&full=true&cursor=${last}`;
    }
    if (pages > 220) break;
  }
  return { rows, pages };
}

async function scanOpenRouter() {
  try {
    const { data } = await getJson('https://openrouter.ai/api/v1/models?output_modalities=text');
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map(row => ({
      source: 'OpenRouter',
      id: String(row?.id || ''),
      free: Number(row?.pricing?.prompt || NaN) === 0 && Number(row?.pricing?.completion || NaN) === 0,
      context: Number(row?.context_length || 0),
      tools: Array.isArray(row?.supported_parameters) && row.supported_parameters.includes('tools')
    }));
  } catch (error) {
    return [{ source: 'OpenRouter', error: String(error?.message || error) }];
  }
}

async function scanPollinations() {
  for (const url of ['https://gen.pollinations.ai/v1/models', 'https://text.pollinations.ai/models']) {
    try {
      const { data } = await getJson(url);
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      if (list.length) return list.map(row => ({ source: 'Pollinations', id: String(row?.id || row?.name || row || '') }));
    } catch {}
  }
  return [];
}

async function scanHorde() {
  try {
    const { data } = await getJson('https://aihorde.net/api/v2/status/models?type=text', { headers: { 'Client-Agent': 'NexusNova:5.7-catalog-scan' } });
    return (Array.isArray(data) ? data : []).map(row => ({ source: 'AI Horde', id: String(row?.name || row?.id || ''), workers: Number(row?.count ?? row?.workers ?? 0) || 0 }));
  } catch (error) {
    return [{ source: 'AI Horde', error: String(error?.message || error) }];
  }
}

const hf = await scanHuggingFace();
const [openrouter, pollinations, horde] = await Promise.all([scanOpenRouter(), scanPollinations(), scanHorde()]);

const validOr = openrouter.filter(x => x.id);
const validPoll = pollinations.filter(x => x.id);
const validHorde = horde.filter(x => x.id);
const unique = new Map();
for (const row of [...hf.rows, ...validOr, ...validPoll, ...validHorde]) {
  const key = `${row.source}::${row.id}`;
  if (row.id && !unique.has(key)) unique.set(key, row);
}

const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  targetPublicModelRecords: TARGET,
  huggingFaceTextGenerationRecordsScanned: hf.rows.length,
  huggingFacePages: hf.pages,
  openRouterTextModels: validOr.length,
  openRouterZeroPriceModels: validOr.filter(x => x.free).length,
  pollinationsCatalogModels: validPoll.length,
  aiHordeActiveTextModels: validHorde.length,
  aiHordeActiveWorkersModels: validHorde.filter(x => x.workers > 0).length,
  totalSourceQualifiedRecords: unique.size,
  note: 'Catalog membership does not mean a route is callable without authentication. Live health verification is a separate gate.'
};

console.log('\n=== NOVA 15K PUBLIC BRAIN CATALOG SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
console.log('\nOPENROUTER_ZERO_PRICE_SAMPLE');
for (const row of validOr.filter(x => x.free).slice(0, 30)) console.log(row.id);
console.log('\nAI_HORDE_ACTIVE_SAMPLE');
for (const row of validHorde.filter(x => x.workers > 0).slice(0, 30)) console.log(`${row.id} | workers=${row.workers}`);

await writeFile('nova57-15000-public-brain-catalog-summary.json', JSON.stringify(summary, null, 2) + '\n');
if (hf.rows.length < TARGET) {
  console.error(`Required ${TARGET} Hugging Face text-generation records, scanned only ${hf.rows.length}.`);
  process.exitCode = 1;
}
