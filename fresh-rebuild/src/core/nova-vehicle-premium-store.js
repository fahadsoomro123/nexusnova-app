import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, waitForFirebaseUser } from './firebase-backend.js';

const functions = getFunctions(firebaseApp);
const createPairingFn = httpsCallable(functions, 'createNovaVehiclePairing');
const dashboardFn = httpsCallable(functions, 'getNovaVehicleDashboard');
const revokeFn = httpsCallable(functions, 'revokeNovaVehicle');

function cleanVehicle(raw = {}) {
  const live = raw?.live && typeof raw.live === 'object' ? raw.live : null;
  return {
    vehicleId: String(raw?.vehicleId || ''),
    displayName: String(raw?.displayName || 'Vehicle'),
    status: String(raw?.status || 'offline'),
    trackerBound: raw?.trackerBound === true,
    trackerOnline: raw?.trackerOnline === true,
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

function unwrap(result) {
  return result?.data && typeof result.data === 'object' ? result.data : {};
}

export async function createNovaVehiclePairing(vehicleName = 'Vehicle') {
  await signedIn();
  const result = unwrap(await createPairingFn({ vehicleName:String(vehicleName || 'Vehicle').slice(0,40) }));
  if (!result.pairingCode || !result.vehicleId) throw new Error('Pairing code could not be created.');
  return {
    vehicleId:String(result.vehicleId),
    vehicleName:String(result.vehicleName || 'Vehicle'),
    pairingCode:String(result.pairingCode),
    expiresAt:Math.max(0, Number(result.expiresAt) || 0)
  };
}

export async function loadNovaVehicleDashboard() {
  await signedIn();
  const result = unwrap(await dashboardFn({}));
  return {
    vehicles:Array.isArray(result.vehicles) ? result.vehicles.map(cleanVehicle) : [],
    serverNow:Math.max(0, Number(result.serverNow) || Date.now())
  };
}

export async function revokeNovaVehicle(vehicleId) {
  await signedIn();
  const id = String(vehicleId || '').trim();
  if (!id) throw new Error('Vehicle id is missing.');
  const result = unwrap(await revokeFn({ vehicleId:id }));
  return result?.ok === true;
}
