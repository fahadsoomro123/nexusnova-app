import { waitForFirebaseUser } from './firebase-backend.js';

const API_BASE = String(
  globalThis.__NEXUSNOVA_CONFIG__?.novaVehicleApiBase ||
  'https://nova-vehicle-premium.fahadsoomro123.workers.dev'
).replace(/\/+$/, '');

function cleanVehicle(raw = {}) {
  const live = raw?.live && typeof raw.live === 'object' ? raw.live : null;
  return {
    vehicleId: String(raw?.vehicleId || ''),
    displayName: String(raw?.displayName || 'Vehicle'),
    status: String(raw?.status || 'offline'),
    trackerBound: raw?.trackerBound === true,
    trackerOnline: raw?.trackerOnline === true,
    trackingPaused: raw?.trackingPaused === true,
    lastSeenAt: Math.max(0, Number(raw?.lastSeenAt) || 0),
    live: live ? {
      latitude: Number(live.latitude) || 0,
      longitude: Number(live.longitude) || 0,
      accuracyM: Math.max(0, Number(live.accuracyM) || 0),
      speedKmh: Math.max(0, Number(live.speedKmh) || 0),
      heading: Math.max(0, Number(live.heading) || 0),
      batteryPct: Math.max(0, Math.min(100, Number(live.batteryPct) || 0)),
      charging: live.charging === true,
      externalPower: live.externalPower === true,
      observedAt: Math.max(0, Number(live.observedAt) || 0),
      receivedAt: Math.max(0, Number(live.receivedAt) || 0)
    } : null
  };
}

async function signedIn() {
  const user = await waitForFirebaseUser(8000);
  if (!user) throw new Error('Sign in to use Nova Vehicle Premium.');
  return user;
}

async function secureOwnerClaim(user) {
  try {
    const token = await user.getIdTokenResult(false);
    const c = token?.claims || {};
    const role = String(c.nexusnovaRole || c.role || '').trim().toLowerCase();
    return c.novaVehicleOwner === true ||
      c.novaVehicleEntitled === true ||
      c.owner === true ||
      c.admin === true ||
      role === 'owner' || role === 'admin';
  } catch {
    return false;
  }
}

function trustedServerEntitlement(result, vehicles) {
  const access = result?.access && typeof result.access === 'object' ? result.access : {};
  const role = String(result?.role || access?.role || '').trim().toLowerCase();
  return result?.entitled === true ||
    result?.owner === true ||
    result?.isOwner === true ||
    result?.subscriptionActive === true ||
    access?.entitled === true ||
    access?.owner === true ||
    access?.subscriptionActive === true ||
    role === 'owner' || role === 'admin' || role === 'subscriber' ||
    vehicles.length > 0;
}

async function api(path, { method = 'GET', body } = {}) {
  const user = await signedIn();
  const idToken = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(body === undefined ? {} : { 'Content-Type':'application/json' })
    },
    ...(body === undefined ? {} : { body:JSON.stringify(body) }),
    cache: 'no-store'
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.message || `Nova Vehicle API error (${response.status}).`);
    error.code = String(payload?.code || `http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { payload:payload && typeof payload === 'object' ? payload : {}, user };
}

export function novaVehicleApiBase() {
  return API_BASE;
}

export async function createNovaVehiclePairing(vehicleName = 'Vehicle') {
  const { payload:result } = await api('/v1/owner/pairing', {
    method:'POST',
    body:{ vehicleName:String(vehicleName || 'Vehicle').slice(0,40) }
  });
  if (!result.pairingCode || !result.vehicleId) throw new Error('Pairing code could not be created.');
  return {
    vehicleId:String(result.vehicleId),
    vehicleName:String(result.vehicleName || 'Vehicle'),
    pairingCode:String(result.pairingCode),
    expiresAt:Math.max(0, Number(result.expiresAt) || 0)
  };
}

export async function loadNovaVehicleDashboard() {
  const { payload:result, user } = await api('/v1/owner/dashboard');
  const vehicles = Array.isArray(result.vehicles) ? result.vehicles.map(cleanVehicle) : [];
  // Only trusted backend response fields, server-scoped owned vehicles, or
  // signed Firebase claims can unlock Tracker. Local UI state cannot grant it.
  const entitled = trustedServerEntitlement(result, vehicles) || await secureOwnerClaim(user);
  return {
    entitled,
    vehicles,
    serverNow:Math.max(0, Number(result.serverNow) || Date.now())
  };
}

export async function setNovaVehiclePaused(vehicleId, paused) {
  const id = String(vehicleId || '').trim();
  if (!id) throw new Error('Vehicle id is missing.');
  const { payload:result } = await api('/v1/owner/pause', {
    method:'POST',
    body:{ vehicleId:id, paused:paused === true }
  });
  return result?.ok === true;
}

export async function revokeNovaVehicle(vehicleId) {
  const id = String(vehicleId || '').trim();
  if (!id) throw new Error('Vehicle id is missing.');
  const { payload:result } = await api('/v1/owner/revoke', { method:'POST', body:{ vehicleId:id } });
  return result?.ok === true;
}