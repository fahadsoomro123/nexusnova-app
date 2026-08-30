# NexusNova Mine Visual Lock — 2026-08-30

Status: LOCKED / APPROVED BASELINE
Branch: nova-sol57-pro-v128
Approved visual baseline commit: d45a1af1e59eb384ba07ff7b47cdfc3094184bcd

## Do not change without explicit user approval
- Mine ring asset, ring colors, saturation, brightness, glow balance, shell/bezel geometry.
- Mine layout geometry and current screen sizing/scale.
- Header, miner panel, tools panel, dock composition and alignment.
- LIVE / SERVER SYNCED alignment and status dots.
- Balance card cleanup.
- SOS must remain absent from Mine.

## Preserve functional state
Mining backend, timer/session progress, balance/state, actions, auth, OTA/runtime behavior and all other working app functionality must remain untouched by future visual work unless explicitly requested.

## Change rule
Any future Mine visual edit must be narrowly scoped, compared against this approved baseline first, and must not silently alter locked geometry, sizing, ring treatment or working mining state.
