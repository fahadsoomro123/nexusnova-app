// NOVA 5.7 Sol — local history safety cleanup.
// Removes only raw transport/provider diagnostic payloads from stored assistant
// history. User messages and normal assistant replies are preserved.

const PREFIX = 'nexus_nova57_history_v1_';

function isTransportDiagnostic(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return /^\s*[\[{].{0,160}["']?@type["']?\s*:/s.test(value)
    || /type\.googleapis\.com\/(?:google\.rpc|google\.firebase)/i.test(value)
    || /^\s*\{\s*"error"\s*:\s*\{/i.test(value)
    || /\b(?:google\.rpc\.|firebase ai error|rpc status)\b/i.test(value) && /^[\[{]/.test(value);
}

function cleanHistoryValue(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return null; }
  if (!Array.isArray(parsed)) return null;
  const cleaned = parsed.filter(turn => {
    if (!turn || typeof turn !== 'object') return false;
    if (turn.role !== 'assistant') return true;
    return !isTransportDiagnostic(turn.text);
  });
  return cleaned.length === parsed.length ? null : cleaned;
}

try {
  const updates = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    const cleaned = cleanHistoryValue(raw);
    if (cleaned) updates.push([key, JSON.stringify(cleaned)]);
  }
  for (const [key, value] of updates) localStorage.setItem(key, value);
  if (updates.length) console.info('[NOVA History Safety] removed raw provider diagnostics', updates.length);
} catch (error) {
  console.warn('[NOVA History Safety] cleanup skipped:', error);
}
