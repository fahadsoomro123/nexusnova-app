const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

const db = getFirestore();
const REGISTRY = 'novaBrainRegistry';
const LEADERS = 'novaBrainLeaders';
const META = 'novaAtomicMeta';
const MAX_MESH_BRAINS = 9;
const MAX_RETURNED_CANDIDATES = 18;
const ALLOWED_CAPABILITIES = new Set(['general', 'coding', 'reasoning', 'research', 'multilingual']);
const ALLOWED_OUTCOMES = new Set(['success', 'verified', 'failure', 'timeout', 'rate-limit', 'auth', 'empty']);

function text(value, max = 12000) {
  return String(value ?? '').trim().slice(0, max);
}

function lower(value) {
  return text(value).toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hashId(source, modelId) {
  return createHash('sha256').update(`${source}:${modelId}`).digest('hex').slice(0, 40);
}

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function meshProfile({ complexity, highConsequence, needsVerification }) {
  if (!needsVerification) return { strategy: 'ARIM', widths: [1], maxBrains: 1, allowExpansion: false, stopOnConsensus: true };
  if (highConsequence) return { strategy: 'ARIM', widths: [2, 2], maxBrains: 5, allowExpansion: false, stopOnConsensus: true };
  if (complexity >= 4) return { strategy: 'ARIM', widths: [2, 2, 4], maxBrains: MAX_MESH_BRAINS, allowExpansion: true, stopOnConsensus: true };
  if (complexity >= 3) return { strategy: 'ARIM', widths: [2, 2], maxBrains: 5, allowExpansion: true, stopOnConsensus: true };
  return { strategy: 'ARIM', widths: [2], maxBrains: 3, allowExpansion: false, stopOnConsensus: true };
}

function taskDNA(prompt) {
  const s = lower(prompt);
  const length = String(prompt || '').length;
  let capability = 'general';
  if (/\b(code|coding|bug|debug|javascript|typescript|python|java|kotlin|swift|sql|github|repository|function|class|api|architecture)\b/.test(s)) capability = 'coding';
  else if (/\b(reason|reasoning|logic|math|prove|derive|constraint|puzzle|schedule|algorithm|calculate|analysis)\b/.test(s)) capability = 'reasoning';
  else if (/\b(research|latest|current|today|news|web|internet|sources?|evidence|verify online)\b/.test(s)) capability = 'research';
  else if (/\b(urdu|roman urdu|roman-urdu|hinglish|multilingual|translate|translation)\b/.test(s)) capability = 'multilingual';

  let complexity = 1;
  if (length > 700 || /\b(explain|compare|analy[sz]e|plan|design|review)\b/.test(s)) complexity = 2;
  if (length > 2200 || /\b(complex|hard|architecture|debug|prove|constraint|research|repository|multi[- ]?step)\b/.test(s)) complexity = 3;
  if (length > 6000 || /\b(exhaustive|deep research|audit|production|critical|multiple files|system design)\b/.test(s)) complexity = 4;

  const highConsequence = /\b(medical|medicine|diagnos|legal|lawyer|lawsuit|financial advice|investment advice|suicide|self-harm|emergency)\b/.test(s);
  const exactOutput = /\b(answer only|return only|output only|no explanation|exactly one|json only)\b/.test(s);
  const needsVerification = highConsequence || complexity >= 3 || capability === 'coding' || capability === 'reasoning';
  const mesh = meshProfile({ complexity, highConsequence, needsVerification });
  return { capability, complexity, highConsequence, exactOutput, needsVerification, maxHops: mesh.maxBrains, mesh };
}

function brainScore(row, capability) {
  const healthScore = clamp(row?.healthScore, -100, 100);
  const successes = Math.max(0, Number(row?.successes || 0));
  const failures = Math.max(0, Number(row?.failures || 0));
  const attempts = successes + failures;
  const successRate = attempts ? successes / attempts : 0.5;
  const latency = Math.max(0, Number(row?.latencyEwmaMs || 0));
  const caps = Array.isArray(row?.capabilities) ? row.capabilities : [];
  const fit = caps.includes(capability) ? 28 : caps.includes('general') ? 8 : 0;
  const callable = row?.endpointKind && row.endpointKind !== 'catalog' ? 18 : 0;
  const healthy = row?.health === 'healthy' ? 22 : row?.health === 'degraded' ? 5 : 0;
  const latencyPenalty = latency ? Math.min(35, latency / 160) : 0;
  return healthScore + successRate * 35 + fit + callable + healthy - latencyPenalty;
}

function normalizeCandidate(row) {
  return {
    source: text(row?.source, 80),
    provider: text(row?.provider || row?.source, 80),
    modelId: text(row?.modelId, 240),
    endpointKind: text(row?.endpointKind, 40),
    capabilities: Array.isArray(row?.capabilities) ? row.capabilities.filter(x => typeof x === 'string').slice(0, 12) : [],
    health: text(row?.health, 30) || 'unknown',
    healthScore: Number(row?.healthScore || 0),
    latencyEwmaMs: Number(row?.latencyEwmaMs || 0),
    successes: Number(row?.successes || 0),
    failures: Number(row?.failures || 0)
  };
}

function uniqueCandidates(rows, capability) {
  const seen = new Set();
  return rows
    .filter(Boolean)
    .map(normalizeCandidate)
    .filter(row => row.modelId && row.provider && row.endpointKind !== 'catalog')
    .filter(row => {
      const key = `${row.provider}::${row.modelId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => brainScore(b, capability) - brainScore(a, capability));
}

async function leaderRows(capability) {
  const docs = await Promise.all([
    db.collection(LEADERS).doc(capability).get(),
    capability === 'general' ? Promise.resolve(null) : db.collection(LEADERS).doc('general').get()
  ]);
  const rows = [];
  for (const snap of docs) {
    if (!snap?.exists) continue;
    const models = Array.isArray(snap.data()?.models) ? snap.data().models : [];
    rows.push(...models);
  }
  return rows;
}

async function registryFallbackRows(capability) {
  const caps = capability === 'research' ? ['general'] : [capability];
  const rows = [];
  for (const cap of caps) {
    try {
      const snap = await db.collection(REGISTRY).where('capabilities', 'array-contains', cap).limit(80).get();
      for (const doc of snap.docs) {
        const row = doc.data() || {};
        if (row.chatCandidate === false) continue;
        rows.push(row);
      }
    } catch (e) {
      console.warn('[NOVA ARIM] registry fallback query:', e.message);
    }
  }
  return rows;
}

function buildGenerations(dna, candidates) {
  const generations = [];
  let offset = 0;
  dna.mesh.widths.forEach((width, index) => {
    const slice = candidates.slice(offset, offset + width);
    if (slice.length) generations.push({ generation: index + 1, width, candidates: slice });
    offset += width;
  });
  const judge = candidates[offset] || null;
  return { generations, judge };
}

function buildLegacyStages(dna, candidates) {
  const stages = [];
  if (candidates[0]) stages.push({ stage: 'primary', candidate: candidates[0] });
  if (dna.mesh.maxBrains >= 3 && candidates[1]) stages.push({ stage: 'verifier', candidate: candidates[1] });
  if (dna.mesh.maxBrains >= 5 && candidates[2]) stages.push({ stage: 'arbiter', candidate: candidates[2] });
  return stages;
}

exports.novaAtomicPlan = onCall({ enforceAppCheck: true }, async req => {
  requireUser(req);
  const prompt = text(req.data?.prompt);
  if (!prompt) throw new HttpsError('invalid-argument', 'Prompt required.');
  const dna = taskDNA(prompt);

  const leaders = await leaderRows(dna.capability);
  let candidates = uniqueCandidates(leaders, dna.capability);
  let source = 'leaderboard';
  if (candidates.length < Math.min(12, dna.mesh.maxBrains + 3)) {
    const fallback = await registryFallbackRows(dna.capability);
    candidates = uniqueCandidates([...candidates, ...fallback], dna.capability);
    source = candidates.length ? 'leaderboard+registry' : 'registry-empty';
  }
  candidates = candidates.slice(0, MAX_RETURNED_CANDIDATES);
  const topology = buildGenerations(dna, candidates);

  return {
    module: 'AI Atomic Chain Reaction Module + Adaptive Recursive Intelligence Mesh',
    strategy: 'ARIM',
    dna,
    mesh: dna.mesh,
    source,
    generations: topology.generations,
    judge: topology.judge,
    stages: buildLegacyStages(dna, candidates),
    candidates
  };
});

async function updateLeaderboard(capability, candidate) {
  if (!ALLOWED_CAPABILITIES.has(capability)) return;
  const ref = db.collection(LEADERS).doc(capability);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = Array.isArray(snap.data()?.models) ? snap.data().models : [];
    const key = `${candidate.provider}::${candidate.modelId}`;
    const next = current.filter(row => `${row?.provider}::${row?.modelId}` !== key);
    next.push(candidate);
    next.sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0));
    tx.set(ref, {
      capability,
      models: next.slice(0, 48),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
}

exports.novaRecordBrainOutcome = onCall({ enforceAppCheck: true }, async req => {
  requireUser(req);
  const source = text(req.data?.source || req.data?.provider, 80);
  const provider = text(req.data?.provider || source, 80);
  const modelId = text(req.data?.modelId || req.data?.model, 240);
  const capabilityRaw = text(req.data?.capability, 30) || 'general';
  const capability = ALLOWED_CAPABILITIES.has(capabilityRaw) ? capabilityRaw : 'general';
  const outcome = text(req.data?.outcome, 30);
  if (!source || !provider || !modelId) throw new HttpsError('invalid-argument', 'Brain identity required.');
  if (!ALLOWED_OUTCOMES.has(outcome)) throw new HttpsError('invalid-argument', 'Unknown brain outcome.');
  const latencyMs = clamp(req.data?.latencyMs, 0, 120000);
  const quality = clamp(req.data?.quality ?? (outcome === 'verified' ? 1 : outcome === 'success' ? 0.8 : 0), 0, 1);
  const succeeded = outcome === 'success' || outcome === 'verified';
  const docRef = db.collection(REGISTRY).doc(hashId(source, modelId));

  let learned;
  await db.runTransaction(async tx => {
    const snap = await tx.get(docRef);
    const previous = snap.data() || {};
    const prevSuccess = Math.max(0, Number(previous.successes || 0));
    const prevFail = Math.max(0, Number(previous.failures || 0));
    const prevLatency = Math.max(0, Number(previous.latencyEwmaMs || 0));
    const successes = prevSuccess + (succeeded ? 1 : 0);
    const failures = prevFail + (succeeded ? 0 : 1);
    const latencyEwmaMs = latencyMs > 0 ? (prevLatency ? prevLatency * 0.76 + latencyMs * 0.24 : latencyMs) : prevLatency;
    const attempts = successes + failures;
    const successRate = attempts ? successes / attempts : 0;
    const latencyBonus = latencyEwmaMs ? Math.max(-18, 18 - latencyEwmaMs / 220) : 0;
    const penalty = outcome === 'auth' ? 38 : outcome === 'rate-limit' ? 20 : outcome === 'timeout' ? 18 : outcome === 'empty' ? 15 : succeeded ? 0 : 12;
    const healthScore = clamp(successRate * 70 + quality * 24 + latencyBonus - penalty, -100, 100);
    const health = outcome === 'auth' ? 'unavailable' : succeeded && healthScore >= 55 ? 'healthy' : succeeded ? 'degraded' : healthScore < 20 ? 'unavailable' : 'degraded';
    const capabilities = [...new Set([...(Array.isArray(previous.capabilities) ? previous.capabilities : []), capability, 'general'])].slice(0, 16);

    learned = {
      source,
      provider,
      modelId,
      endpointKind: text(previous.endpointKind, 40) || 'learned-route',
      capabilities,
      chatCandidate: true,
      successes,
      failures,
      latencyEwmaMs,
      healthScore,
      health,
      lastOutcome: outcome,
      lastHealthAt: FieldValue.serverTimestamp(),
      lastErrorKind: succeeded ? null : outcome
    };
    tx.set(docRef, learned, { merge: true });
  });

  const leaderCandidate = {
    source,
    provider,
    modelId,
    endpointKind: learned.endpointKind,
    capabilities: learned.capabilities,
    health: learned.health,
    healthScore: learned.healthScore,
    latencyEwmaMs: learned.latencyEwmaMs,
    successes: learned.successes,
    failures: learned.failures,
    score: brainScore(learned, capability),
    learnedAt: Date.now()
  };
  await updateLeaderboard(capability, leaderCandidate);
  if (capability !== 'general') await updateLeaderboard('general', leaderCandidate);
  await db.collection(META).doc('learning').set({ lastOutcomeAt: FieldValue.serverTimestamp() }, { merge: true });

  return {
    accepted: true,
    capability,
    health: learned.health,
    healthScore: learned.healthScore,
    latencyEwmaMs: learned.latencyEwmaMs
  };
});

exports.novaAtomicStatus = onCall({ enforceAppCheck: true }, async req => {
  requireUser(req);
  const [learning, general] = await Promise.all([
    db.collection(META).doc('learning').get(),
    db.collection(LEADERS).doc('general').get()
  ]);
  return {
    module: 'AI Atomic Chain Reaction Module + Adaptive Recursive Intelligence Mesh',
    strategy: 'ARIM',
    maxMeshBrains: MAX_MESH_BRAINS,
    learning: learning.data() || {},
    generalLeaderboardSize: Array.isArray(general.data()?.models) ? general.data().models.length : 0
  };
});

exports.__novaAtomicChainInternals = {
  taskDNA,
  meshProfile,
  brainScore,
  hashId,
  uniqueCandidates,
  buildGenerations,
  buildLegacyStages,
  MAX_MESH_BRAINS
};
