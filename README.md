# NexusNova Clean Rebuild 2026-08-20

This branch is a clean-source rebuild track.

Rules:
- No legacy UI structure is imported by default.
- Bottom navigation: MINE + NOVA HUB only.
- Mining is rebuilt as one compact modern dashboard without unnecessary vertical scrolling.
- Nova Hub is rebuilt as a direct app grid with no Tools folder; individual tools are first-class apps.
- Every app screen must be content-height driven, compact, futuristic, and free of useless black blank space.
- No duplicate headers, overlapping bottom dock, or legacy 5-tab flash.
- Auth/session state must initialize before the app shell becomes visible.
- Proven feature behavior may be reimplemented cleanly, but old patch layers are not carried forward.
- Final acceptance requires build verification plus phone testing; syntax/static checks alone are not acceptance.

The previous main branch and Golden Master Candidate remain untouched as recovery sources.
