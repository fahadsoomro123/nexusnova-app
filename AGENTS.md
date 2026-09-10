# NexusNova Public Build Mirror Rules

This repository is a sanitized public build mirror. It is not the development source of truth.

## Allowed here

- ordinary non-secret Android debug build / CI;
- sanitized build-required source and assets;
- workflow verification for `NexusNova Fast Public Android Build`.

## Route back to the private repo / laptop

If a task involves any of the following, do not do it here. Use the private repo `fahadsoomro123/nexusnova-app` and, when needed, the laptop/self-hosted Windows runner:

- secrets, passwords, tokens, credentials, service-account/admin material;
- live Firebase/API configuration that GitHub flags as a credential or that enables real backend access;
- signing keys, keystores, release signing, or the original permanent signing key;
- private infrastructure, VPN/private configuration, recovery material, or protected local files;
- ADB/USB/device access, hardware-specific QA, or laptop-only tooling;
- anything that must remain private.

Never add secret, signing, or live backend credential material to this public repository.

## Firebase / backend rule

- This public mirror intentionally contains sanitized Firebase configuration and disabled Firebase/auth/backend stubs.
- Real Firebase authentication, Firestore, FCM, App Check, or credential-backed runtime QA must use the private repo + laptop route.
- Public CI includes a credential-pattern gate and must fail if Google API keys, private keys, GitHub-token-like values, or AWS access-key patterns appear in the checked-out snapshot.

## Development rule

- Do not develop directly in this public mirror.
- The private repo remains the source of truth.
- Sync only a sanitized build-required snapshot here.
- If uncertain whether material is safe for public use, stop and route the task to the private repo instead.
