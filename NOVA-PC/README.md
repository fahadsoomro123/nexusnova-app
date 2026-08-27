# NOVA 5.7 Sol Desktop

Windows desktop host for the NexusNova NOVA 5.7 Sol interface.

## Local AI

The app starts a loopback-only gateway on `127.0.0.1:17777` and talks to Ollama on `127.0.0.1:11434`.

Model preference:
1. `qwen3:4b-instruct`
2. `qwen3:4b`
3. `gpt-oss:20b`
4. first available Ollama model

The UI identifies itself as NOVA 5.7 Sol while preserving truthful underlying-model provenance when asked.

## Security

- local gateway binds to loopback only
- per-launch random gateway token
- Electron Node integration disabled
- context isolation and sandbox enabled
- microphone/media permissions restricted to the NexusNova production origin
- external links open outside the app
- Windows code signing is not configured yet, so SmartScreen may warn on the generated installer
