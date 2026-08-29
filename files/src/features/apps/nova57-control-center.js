// NOVA dashboard/ARIM control center retired.
// Kept as a compatibility stub so the existing NOVA renderer can load without
// changing the rest of the approved chat UI. No 200K registry, route polling,
// atomic-chain telemetry, background refresh, or control-center network work runs.

export function mountNovaControlCenter() {
  return {
    show() {},
    hide() {},
    destroy() {},
    async refresh() { return null; }
  };
}
