from pathlib import Path

worker = Path('cloudflare/nova-brain-worker/src/index.js')
w = worker.read_text()
if 'async function generateRelay(request, env)' not in w:
    anchor = '\nasync function handle(request, env, ctx) {'
    if anchor not in w:
        raise SystemExit('Worker handle anchor not found')
    relay = r'''
async function generateRelay(request, env) {
  const appCheckToken = request.headers.get('x-firebase-appcheck') || '';
  const appCheckClaims = await verifyAppCheckToken(appCheckToken);
  if (!appCheckClaims) return json({ ok: false, error: 'app-check-required' }, 401);

  let body = {};
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid-json' }, 400); }

  const prompt = text(body?.prompt, 12000);
  if (!prompt) return json({ ok: false, error: 'prompt-required' }, 400);
  const requestedCapability = text(body?.capability, 30);
  const capability = ALLOWED_CAPABILITIES.has(requestedCapability) ? requestedCapability : 'general';
  const maxTokens = Math.max(96, Math.min(900, Number(body?.maxTokens || 700) || 700));
  const temperature = Math.max(0.1, Math.min(1.0, Number(body?.temperature ?? 0.4) || 0.4));

  // Transport-only relay: prompt text is never written to D1/meta/route telemetry.
  const currentPlan = await plan(env, capability);
  const fallback = [
    { provider: 'Kilo', modelId: 'kilo-auto/free' },
    { provider: 'Kilo', modelId: 'openrouter/free' },
    { provider: 'Kilo', modelId: 'stepfun/step-3.7-flash:free' }
  ];
  const seen = new Set();
  const candidates = [...(Array.isArray(currentPlan?.candidates) ? currentPlan.candidates : []), ...fallback]
    .filter(row => {
      const provider = text(row?.provider || row?.source, 80);
      const modelId = text(row?.modelId || row?.model, 240);
      const key = `${provider}::${modelId}`;
      if (!modelId || !CALLABLE_CLIENT_PROVIDERS.has(provider) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);

  if (!candidates.length) return json({ ok: false, error: 'no-callable-route' }, 503);

  async function callCandidate(row) {
    const provider = text(row?.provider || row?.source, 80);
    const modelId = text(row?.modelId || row?.model, 240);
    const base = provider === 'Kilo' ? KILO_BASE : OVH_BASE;
    const started = now();
    const { data } = await fetchJson(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
        stream: false
      })
    }, 2700);
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.text ?? '';
    const answer = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : text(part?.text || part?.content, 3000)).join('').trim()
        : '';
    if (!answer) throw new Error('empty-provider-answer');
    return { provider, modelId, text: answer.slice(0, 12000), latencyMs: now() - started };
  }

  try {
    const winner = await Promise.any(candidates.map((row, index) => new Promise(resolve => setTimeout(resolve, index * 70)).then(() => callCandidate(row))));
    return json({ ok: true, capability, provider: winner.provider, model: winner.modelId, text: winner.text, latencyMs: winner.latencyMs });
  } catch {
    return json({ ok: false, error: 'all-relay-routes-failed', capability }, 503);
  }
}
'''
    w = w.replace(anchor, '\n' + relay + anchor, 1)

route_anchor = "  if (request.method === 'POST' && url.pathname === '/v1/outcome') {"
route_block = "  if (request.method === 'POST' && url.pathname === '/v1/generate') {\n    return generateRelay(request, env);\n  }\n\n"
if "url.pathname === '/v1/generate'" not in w:
    if route_anchor not in w:
        raise SystemExit('Worker outcome route anchor not found')
    w = w.replace(route_anchor, route_block + route_anchor, 1)
worker.write_text(w)

client = Path('fresh-rebuild/src/nova57-atomic-backend-client.js')
c = client.read_text()
if 'export async function generateViaAtomicRelay' not in c:
    anchor = '\nexport function reportAtomicOutcome(payload = {}) {'
    if anchor not in c:
        raise SystemExit('Atomic backend client outcome anchor not found')
    fn = r'''
export async function generateViaAtomicRelay(prompt, options = {}) {
  if (!ready()) throw new Error('NOVA relay is not configured.');
  const value = String(prompt || '').trim();
  if (!value) throw new Error('NOVA relay prompt is empty.');
  const appCheckToken = await freshAppCheckToken();
  if (!appCheckToken) throw new Error('NOVA relay App Check token is unavailable.');
  const allowed = new Set(['general', 'coding', 'reasoning', 'research', 'multilingual']);
  const capability = allowed.has(String(options.capability || '')) ? String(options.capability) : capabilityOf(value);
  const data = await post('/v1/generate', {
    prompt: value.slice(0, 12000),
    capability,
    maxTokens: Math.max(96, Math.min(900, Number(options.maxTokens || 700) || 700)),
    temperature: Math.max(0.1, Math.min(1, Number(options.temperature ?? 0.4) || 0.4))
  }, 3200, { 'X-Firebase-AppCheck': appCheckToken });
  if (!data?.ok || !String(data?.text || '').trim()) throw new Error(`NOVA relay failed: ${String(data?.error || 'empty-answer')}`);
  return {
    text: String(data.text).trim(),
    provider: String(data.provider || 'NOVA Relay'),
    model: String(data.model || 'worker-route'),
    latencyMs: Math.max(0, Number(data.latencyMs || 0)),
    capability
  };
}
'''
    c = c.replace(anchor, '\n' + fn + anchor, 1)
client.write_text(c)

orch = Path('fresh-rebuild/src/nova57-pro-orchestrator.js')
o = orch.read_text()
import_anchor = "} from './nova57-atomic-chain.js';\n"
import_line = "import { generateViaAtomicRelay } from './nova57-atomic-backend-client.js';\n"
if import_line not in o:
    if import_anchor not in o:
        raise SystemExit('Orchestrator import anchor not found')
    o = o.replace(import_anchor, import_anchor + import_line, 1)

if 'async function generateForRuntime(' not in o:
    helper_anchor = '\nfunction emit(stage, detail = {}) {'
    if helper_anchor not in o:
        raise SystemExit('Orchestrator emit anchor not found')
    helper = r'''
function mobileRelayPreferred() {
  const bridge = globalThis?.NexusAppCheckAndroid;
  return Boolean(bridge && typeof bridge.postMessage === 'function');
}

async function generateForRuntime(model, prompt, capability, options = {}) {
  if (mobileRelayPreferred()) {
    try {
      const cfg = options?.generationConfig || {};
      const relay = await generateViaAtomicRelay(prompt, {
        capability,
        maxTokens: cfg.maxOutputTokens || 700,
        temperature: cfg.temperature ?? 0.4
      });
      const brain = {
        provider: relay.provider,
        model: relay.model,
        latencyMs: relay.latencyMs,
        wallMs: relay.latencyMs,
        profile: capability || 'general',
        relay: true,
        deterministic: false,
        verified: false
      };
      globalThis.__NOVA_BRAIN_LAST__ = { ...brain, attempts: 1, at: new Date().toISOString() };
      return { response: { text: () => relay.text }, __novaAtomicBrain: brain };
    } catch (error) {
      console.warn('[NOVA Mobile Relay] authenticated Worker relay unavailable; falling back to direct router.', error);
    }
  }
  return model.generateContent(prompt);
}
'''
    o = o.replace(helper_anchor, '\n' + helper + helper_anchor, 1)

o = o.replace('generate: nextPrompt => hedgeModel.generateContent(nextPrompt)', 'generate: nextPrompt => generateForRuntime(hedgeModel, nextPrompt, dna.capability, runtimeOptions)')
o = o.replace(': await hedgeModel.generateContent(groundedPrompt);', ': await generateForRuntime(hedgeModel, groundedPrompt, dna.capability, runtimeOptions);')
o = o.replace(': await hedgeModel.generateContent(original);', ': await generateForRuntime(hedgeModel, original, dna.capability, runtimeOptions);')
orch.write_text(o)
