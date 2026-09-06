# NexusNova Work Routing Rules

These rules are mandatory for AI agents, developers, and CI changes in this repository.

## Source of truth

- `fahadsoomro123/nexusnova-app` is the private development source of truth.
- Active working branch: `ai-photo-real-canva-ai-generator-correction`.

## Secret / sensitive / laptop-only work

Use the private repository and the laptop/self-hosted Windows runner when a task involves any of the following:

- signing keys, keystores, passwords, tokens, secrets, private credentials, service-account/admin material, private infrastructure, VPN/private configuration, or any non-public config;
- release signing or anything that must use the original permanent signing key;
- hardware/device/laptop-specific QA, ADB/USB/device access, local-only tools, or local protected files;
- work that must not be copied to a public repository.

Never copy secret or signing material into the public mirror.

## Routine non-secret Android build / CI

For ordinary sanitized Android APK CI, use:

- public build mirror: `fahadsoomro123/nexusnova-app-public-build`
- workflow: `NexusNova Fast Public Android Build`

Do not use the laptop/self-hosted runner for routine non-secret debug APK builds unless laptop-specific QA is actually required.

## Public mirror rules

- The public mirror is build-only and is not the development source of truth.
- Do not develop directly in the public mirror.
- Sync only the minimum sanitized build-required snapshot from the private repo.
- Keep signing keys, passwords, secrets, private infrastructure, recovery material, and unnecessary source/reference assets out of the public mirror.

## Routing decision

1. If the task contains secrets/private material or needs laptop/device access -> private repo + laptop/self-hosted runner.
2. If the task is ordinary non-secret Android build/CI -> sanitized public mirror + public GitHub Actions workflow.
3. If uncertain -> stay in the private repo and do not expose the material publicly.
