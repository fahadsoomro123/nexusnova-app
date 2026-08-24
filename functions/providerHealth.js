const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');

const TRAVEL_PROVIDER_CONFIG = defineSecret('NEXUSNOVA_TRAVEL_PROVIDERS');
const ENTERTAINMENT_PROVIDER_CONFIG = defineSecret('NEXUSNOVA_ENTERTAINMENT_PROVIDERS');
const LEARNING_PROVIDER_CONFIG = defineSecret('NEXUSNOVA_LEARNING_PROVIDERS');

function requireUser(req) {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
}

function parseSecret(secret, label) {
  let raw = '';
  try { raw = String(secret.value() || '').trim(); } catch {}
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw new HttpsError('internal', `${label} provider secret is invalid JSON.`); }
}

exports.getProviderHealth = onCall({
  enforceAppCheck: true,
  timeoutSeconds: 15,
  memory: '256MiB',
  secrets: [TRAVEL_PROVIDER_CONFIG, ENTERTAINMENT_PROVIDER_CONFIG, LEARNING_PROVIDER_CONFIG]
}, async req => {
  requireUser(req);
  const travel = parseSecret(TRAVEL_PROVIDER_CONFIG, 'Travel');
  const entertainment = parseSecret(ENTERTAINMENT_PROVIDER_CONFIG, 'Entertainment');
  const learning = parseSecret(LEARNING_PROVIDER_CONFIG, 'Learning');

  const health = {
    travel: {
      duffel: Boolean(String(travel.duffelAccessToken || process.env.DUFFEL_ACCESS_TOKEN || '').trim()),
      amadeus: Boolean(
        String(travel.amadeusClientId || process.env.AMADEUS_CLIENT_ID || '').trim() &&
        String(travel.amadeusClientSecret || process.env.AMADEUS_CLIENT_SECRET || '').trim()
      ),
      distribusion: Boolean(String(travel.distribusionApiKey || '').trim())
    },
    entertainment: {
      youtube: Boolean(String(entertainment.youtubeApiKey || process.env.YOUTUBE_API_KEY || '').trim()),
      tmdb: Boolean(String(entertainment.tmdbBearerToken || process.env.TMDB_BEARER_TOKEN || '').trim()),
      dailymotion: true
    },
    learning: {
      googleCse: Boolean(
        String(learning.googleCseApiKey || process.env.GOOGLE_CSE_API_KEY || '').trim() &&
        String(learning.googleCseCx || process.env.GOOGLE_CSE_CX || '').trim()
      )
    }
  };

  return {
    ok: true,
    checkedAt: Date.now(),
    health,
    allConfigured:
      health.travel.duffel &&
      health.travel.amadeus &&
      health.travel.distribusion &&
      health.entertainment.youtube &&
      health.entertainment.tmdb &&
      health.learning.googleCse
  };
});
