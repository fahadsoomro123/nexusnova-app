'use strict';

const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'nexusnova-6ade2';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID
  });
}

const registry = require('./novaBrainRegistry');
const profiler = require('./novaBrainProfiler');

const refreshRegistry = registry?.__novaBrainRegistryInternals?.refreshRegistry;
const profileCycle = profiler?.__novaBrainProfilerInternals?.profileCycle;

if (typeof refreshRegistry !== 'function') {
  throw new Error('NOVA registry bootstrap hook is unavailable.');
}
if (typeof profileCycle !== 'function') {
  throw new Error('NOVA profiler bootstrap hook is unavailable.');
}

function cyclesArg(argv) {
  const raw = argv.find(value => /^--cycles=\d+$/.test(value));
  const requested = raw ? Number(raw.split('=')[1]) : 1;
  return Math.max(1, Math.min(5, requested || 1));
}

async function main() {
  const cycles = cyclesArg(process.argv.slice(2));
  const registryCycles = [];

  for (let index = 0; index < cycles; index += 1) {
    const result = await refreshRegistry();
    registryCycles.push({
      cycle: index + 1,
      target: Number(result?.target || 0),
      hf: {
        recordsSeenThisRun: Number(result?.hf?.recordsSeenThisRun || 0),
        totalSeen: Number(result?.hf?.totalSeen || 0),
        shardWrites: Number(result?.hf?.shardWrites || 0),
        pages: Number(result?.hf?.pages || 0),
        complete: result?.hf?.complete === true
      },
      providerCatalogs: {
        openRouterSeen: Number(result?.openRouter?.seen || 0),
        hordeSeen: Number(result?.horde?.seen || 0),
        pollinationsSeen: Number(result?.pollinations?.seen || 0)
      }
    });

    if (result?.hf?.complete === true) break;
  }

  const profilerResult = await profileCycle();
  const output = {
    ok: true,
    projectId: PROJECT_ID,
    storageMode: 'sharded-catalog-v2',
    registryCycles,
    profiler: {
      probeLimit: Number(profilerResult?.probeLimit || 0),
      probed: Array.isArray(profilerResult?.probed)
        ? profilerResult.probed.map(row => ({
            provider: String(row?.provider || ''),
            modelId: String(row?.modelId || ''),
            outcome: String(row?.outcome || ''),
            latencyMs: Number(row?.latencyMs || 0)
          }))
        : [],
      leaderboards: profilerResult?.leaderboards || {}
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error('[NOVA Bootstrap] failed:', String(error?.message || error));
  process.exitCode = 1;
});
