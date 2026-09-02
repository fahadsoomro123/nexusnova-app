import workerV2 from './index-v2.js';

const CORS = Object.freeze({
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,content-type',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Cache-Control':'no-store'
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ ...CORS, 'Content-Type':'application/json; charset=utf-8' }
  });
}

function clean(value, max = 200) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) return '';
  return text;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}

function textBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(String(value)));
}

function pemBytes(pem) {
  const base64 = String(pem || '')
    .replace(/-----BEGIN [^-]+-----/g,'')
    .replace(/-----END [^-]+-----/g,'')
    .replace(/\s+/g,'');
  if (!base64) throw new Error('invalid_private_key');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function account(env) {
  const raw = JSON.parse(String(env.FIREBASE_SERVICE_ACCOUNT_JSON || ''));
  const clientEmail = clean(raw?.client_email, 254);
  const privateKey = String(raw?.private_key || '');
  const secretProjectId = clean(raw?.project_id, 120);
  const configuredProjectId = clean(env.FIREBASE_PROJECT_ID, 120);
  if (!clientEmail || !privateKey.includes('BEGIN PRIVATE KEY') || !secretProjectId) {
    throw new Error('service_account_incomplete');
  }
  return { clientEmail, privateKey, secretProjectId, configuredProjectId };
}

async function accessToken(env) {
  const acct = account(env);
  const now = Math.floor(Date.now() / 1000);
  const header = textBase64Url(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const payload = textBase64Url(JSON.stringify({
    iss:acct.clientEmail,
    scope:'https://www.googleapis.com/auth/datastore',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now + 3600
  }));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(acct.privateKey),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(input)
  );
  const assertion = `${input}.${bytesToBase64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) {
    return { ok:false, httpStatus:response.status, googleStatus:String(body?.error || ''), acct };
  }
  return { ok:true, token:String(body.access_token), acct };
}

async function deepHealth(env) {
  let auth;
  try { auth = await accessToken(env); }
  catch (error) {
    return json({
      ok:false,
      service:'nova-mining-rewards',
      version:'v2-storage-diagnostic',
      stage:'service-account-parse-or-sign',
      error:clean(error?.message, 120) || 'unknown'
    }, 503);
  }

  if (!auth.ok) {
    return json({
      ok:false,
      service:'nova-mining-rewards',
      version:'v2-storage-diagnostic',
      stage:'google-oauth',
      oauthHttpStatus:auth.httpStatus,
      oauthStatus:auth.googleStatus,
      configuredProjectId:auth.acct.configuredProjectId,
      secretProjectId:auth.acct.secretProjectId,
      projectMatch:auth.acct.configuredProjectId === auth.acct.secretProjectId
    }, 503);
  }

  const projectId = auth.acct.configuredProjectId || auth.acct.secretProjectId;
  const probeUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/__nexusnova_health__/permission-probe`;
  const response = await fetch(probeUrl, {
    method:'GET',
    headers:{ Authorization:`Bearer ${auth.token}`, Accept:'application/json' }
  });
  const body = await response.json().catch(() => ({}));
  const statusText = clean(body?.error?.status, 80);
  const message = clean(body?.error?.message, 220);
  const storageAccess = response.status === 404 || response.ok;

  return json({
    ok:storageAccess,
    service:'nova-mining-rewards',
    version:'v2-storage-diagnostic',
    functionsDependency:false,
    oauthReady:true,
    configuredProjectId:auth.acct.configuredProjectId,
    secretProjectId:auth.acct.secretProjectId,
    projectMatch:auth.acct.configuredProjectId === auth.acct.secretProjectId,
    firestoreHttpStatus:response.status,
    firestoreStatus:statusText || (response.status === 404 ? 'NOT_FOUND_EXPECTED' : ''),
    firestoreMessage:message,
    storageAccess
  }, storageAccess ? 200 : 503);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return deepHealth(env);
    return workerV2.fetch(request, env, ctx);
  }
};
