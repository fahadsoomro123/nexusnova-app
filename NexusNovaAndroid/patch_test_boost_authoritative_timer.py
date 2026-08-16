from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www/js')
MINING = ROOT / 'rewards-security-v1.js'
BOOST = ROOT / 'nexusnova-admob-nexus-pass-v1.js'

for path in (MINING, BOOST):
    if not path.exists():
        raise SystemExit(f'Missing prepared Android asset: {path}')

mining = MINING.read_text(encoding='utf-8')
boost = BOOST.read_text(encoding='utf-8')
MARKER = 'nx-test-boost-authoritative-timer-v5'

if MARKER in mining and MARKER in boost:
    print('TEST boost authoritative timer guard already applied.')
    raise SystemExit(0)

# ---------------------------------------------------------------------------
# Mining engine: keep the Firestore timestamp authoritative. TEST rewarded
# boosts only change a bounded display offset. This prevents an accelerated
# debug timer from falsely claiming that Firestore's 24H session is complete,
# and prevents debug boosts from inflating the projected NVX balance.
# ---------------------------------------------------------------------------
needle = "  const MINING_START_AD_TIMEOUT_MS = 50_000;\n"
insert = """  const MINING_START_AD_TIMEOUT_MS = 50_000;
  const MAX_TEST_PREVIEW_OFFSET_MS = 12 * HOUR;
  // nx-test-boost-authoritative-timer-v5
"""
if needle not in mining:
    raise SystemExit('Mining constant insertion point not found')
mining = mining.replace(needle, insert, 1)

needle = "  let miningStartAdPending = false;\n"
insert = """  let miningStartAdPending = false;
  let miningPreviewOffsetMs = 0;
"""
if needle not in mining:
    raise SystemExit('Mining preview state insertion point not found')
mining = mining.replace(needle, insert, 1)

old = """    const startedAt = Number(miningState.startedAt) || 0;
    const elapsedNow = Math.max(0, Date.now() - startedAt);
    if (startedAt <= 0 || elapsedNow >= DAY) {
      button.dataset.state = 'complete';
      button.classList.remove('active');
      text.textContent = 'CLAIM + START NEXT';
      timer.classList.add('nx-complete');
      timer.textContent = 'SESSION COMPLETE • TAP TO CONTINUE';
      setVisibleBalance(Number(miningState.balance) + MINING_REWARD);
      return;
    }

    button.dataset.state = 'active';
    button.classList.add('active');
    text.textContent = 'MINING ACTIVE';

    const tick = () => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      const left = Math.max(0, DAY - elapsed);
      if (left <= 0) {
        clearInterval(miningTimer);
        miningTimer = null;
        renderMiningAuthoritative();
        return;
      }
      timer.textContent = formatClock(left);
      const projected = Number(miningState.balance) + Math.min(MINING_REWARD, elapsed / HOUR);
      setVisibleBalance(projected);
    };

    tick();
    miningTimer = setInterval(tick, 1000);
"""
new = """    const startedAt = Number(miningState.startedAt) || 0;
    const authoritativeElapsedNow = Math.max(0, Date.now() - startedAt);
    const previewOffset = Math.max(0, Math.min(MAX_TEST_PREVIEW_OFFSET_MS, Number(miningPreviewOffsetMs) || 0));
    if (startedAt <= 0 || authoritativeElapsedNow >= DAY) {
      button.dataset.state = 'complete';
      button.classList.remove('active');
      text.textContent = 'CLAIM + START NEXT';
      timer.classList.add('nx-complete');
      timer.textContent = 'SESSION COMPLETE • TAP TO CONTINUE';
      setVisibleBalance(Number(miningState.balance) + MINING_REWARD);
      return;
    }

    const displayElapsedNow = authoritativeElapsedNow + previewOffset;
    if (previewOffset > 0 && displayElapsedNow >= DAY) {
      button.dataset.state = 'active';
      button.classList.add('active');
      text.textContent = 'TEST BOOST PREVIEW COMPLETE';
      timer.classList.add('nx-complete');
      const previewTick = () => {
        const authoritativeElapsed = Math.max(0, Date.now() - startedAt);
        const secureLeft = Math.max(0, DAY - authoritativeElapsed);
        if (secureLeft <= 0) {
          clearInterval(miningTimer);
          miningTimer = null;
          renderMiningAuthoritative();
          return;
        }
        timer.textContent = `TEST PREVIEW 00:00:00 • SECURE ${formatClock(secureLeft)}`;
        const projected = Number(miningState.balance) + Math.min(MINING_REWARD, authoritativeElapsed / HOUR);
        setVisibleBalance(projected);
      };
      previewTick();
      miningTimer = setInterval(previewTick, 1000);
      return;
    }

    button.dataset.state = 'active';
    button.classList.add('active');
    text.textContent = previewOffset > 0 ? 'MINING ACTIVE • TEST BOOST' : 'MINING ACTIVE';

    const tick = () => {
      const authoritativeElapsed = Math.max(0, Date.now() - startedAt);
      if (authoritativeElapsed >= DAY) {
        clearInterval(miningTimer);
        miningTimer = null;
        renderMiningAuthoritative();
        return;
      }
      const displayElapsed = authoritativeElapsed + previewOffset;
      const left = Math.max(0, DAY - displayElapsed);
      if (previewOffset > 0 && left <= 0) {
        clearInterval(miningTimer);
        miningTimer = null;
        renderMiningAuthoritative();
        return;
      }
      timer.textContent = formatClock(left);
      // TEST display acceleration must never fabricate NVX earnings. The
      // projected balance follows only the authoritative Firestore session.
      const projected = Number(miningState.balance) + Math.min(MINING_REWARD, authoritativeElapsed / HOUR);
      setVisibleBalance(projected);
    };

    tick();
    miningTimer = setInterval(tick, 1000);
"""
if old not in mining:
    raise SystemExit('Mining timer replacement block not found')
mining = mining.replace(old, new, 1)

old = """    const balance = Number(data.balance);
    const totalMined = Number(data.totalMined);
    miningState.known = true;
    miningState.active = data.miningActive === true || data.active === true;
    miningState.startedAt = miningState.active
      ? Number(data.miningStartedAt ?? data.startedAt) || 0
      : 0;
"""
new = """    const balance = Number(data.balance);
    const totalMined = Number(data.totalMined);
    const previousStartedAt = Number(miningState.startedAt) || 0;
    const nextActive = data.miningActive === true || data.active === true;
    const nextStartedAt = nextActive
      ? Number(data.miningStartedAt ?? data.startedAt) || 0
      : 0;
    if (!nextActive || (previousStartedAt > 0 && nextStartedAt !== previousStartedAt)) {
      miningPreviewOffsetMs = 0;
    }
    miningState.known = true;
    miningState.active = nextActive;
    miningState.startedAt = nextStartedAt;
"""
if old not in mining:
    raise SystemExit('Mining adoptState replacement block not found')
mining = mining.replace(old, new, 1)

needle = """  window.nexusSecureAdoptMiningState = state => {
    if (state && typeof state === 'object') adoptState(state);
    return { ...miningState };
  };
  window.nexusSecureMiningState = () => ({ ...miningState, startAdPending:miningStartAdPending });
"""
replacement = """  window.nexusSecureAdoptMiningState = state => {
    if (state && typeof state === 'object') adoptState(state);
    return { ...miningState, previewOffsetMs:miningPreviewOffsetMs };
  };
  window.nexusSecureSetMiningPreviewOffset = offsetMs => {
    miningPreviewOffsetMs = Math.max(0, Math.min(MAX_TEST_PREVIEW_OFFSET_MS, Number(offsetMs) || 0));
    renderMiningAuthoritative();
    return miningPreviewOffsetMs;
  };
  window.nexusSecureMiningState = () => ({ ...miningState, startAdPending:miningStartAdPending, previewOffsetMs:miningPreviewOffsetMs });
"""
if needle not in mining:
    raise SystemExit('Mining preview hook insertion point not found')
mining = mining.replace(needle, replacement, 1)

# ---------------------------------------------------------------------------
# TEST boost layer: its own panel can still use an effective timestamp for
# counts/remaining-time validation, but the authoritative mining engine receives
# only a display offset. Production status also clears any old debug overlay.
# ---------------------------------------------------------------------------
needle = "  // nx-test-boost-final2h-guard-v4\n"
replacement = """  // nx-test-boost-final2h-guard-v4
  // nx-test-boost-authoritative-timer-v5
"""
if needle not in boost:
    raise SystemExit('Boost marker insertion point not found')
boost = boost.replace(needle, replacement, 1)

old = """    if (testMode && active && !malformed) {
      const testOverlay = readTestRewardOverlay(anchorAt);
      if (testOverlay.extraUses > 0) {
        setTimeout(() => {
          try { window.nexusSecureAdoptMiningState?.({ miningActive:true, miningStartedAt:startedAt }); } catch (_) {}
        }, 0);
      }
    }
"""
new = """    if (testMode && active && !malformed) {
      const testOverlay = readTestRewardOverlay(anchorAt);
      setTimeout(() => {
        try { window.nexusSecureSetMiningPreviewOffset?.(testOverlay.extraUses * BOOST_MS); } catch (_) {}
      }, 0);
    } else if (!active) {
      setTimeout(() => {
        try { window.nexusSecureSetMiningPreviewOffset?.(0); } catch (_) {}
      }, 0);
    }
"""
if old not in boost:
    raise SystemExit('Boost snapshot preview sync block not found')
boost = boost.replace(old, new, 1)

old = """    try {
      window.nexusSecureAdoptMiningState?.({
        miningActive:true,
        miningStartedAt:effectiveStartedAt
      });
    } catch (_) {}
"""
new = """    try {
      window.nexusSecureSetMiningPreviewOffset?.(overlay.extraUses * BOOST_MS);
    } catch (_) {}
"""
if old not in boost:
    raise SystemExit('Boost immediate preview sync block not found')
boost = boost.replace(old, new, 1)

old = """  function handleNativeEvent(event) {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    testMode = detail.testMode !== false;

    switch (String(detail.event || '')) {
"""
new = """  function handleNativeEvent(event) {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    const wasTestMode = testMode;
    testMode = detail.testMode !== false;
    if (wasTestMode && !testMode) {
      // A production/release native status must never inherit a local debug
      // reward overlay from a previous TEST install/session.
      try { localStorage.removeItem(TEST_REWARD_OVERLAY_KEY); } catch (_) {}
      try { window.nexusSecureSetMiningPreviewOffset?.(0); } catch (_) {}
      pendingRewardFxKind = '';
      pendingKind = '';
      void syncMiningState().catch(() => {});
    }

    switch (String(detail.event || '')) {
"""
if old not in boost:
    raise SystemExit('Boost production-mode cleanup insertion point not found')
boost = boost.replace(old, new, 1)

MINING.write_text(mining, encoding='utf-8')
BOOST.write_text(boost, encoding='utf-8')

checks = [
    (MINING, MARKER),
    (MINING, 'MAX_TEST_PREVIEW_OFFSET_MS = 12 * HOUR'),
    (MINING, 'window.nexusSecureSetMiningPreviewOffset'),
    (MINING, 'TEST BOOST PREVIEW COMPLETE'),
    (MINING, 'TEST PREVIEW 00:00:00 • SECURE'),
    (MINING, 'projected = Number(miningState.balance) + Math.min(MINING_REWARD, authoritativeElapsed / HOUR)'),
    (BOOST, MARKER),
    (BOOST, 'window.nexusSecureSetMiningPreviewOffset?.(overlay.extraUses * BOOST_MS)'),
    (BOOST, 'localStorage.removeItem(TEST_REWARD_OVERLAY_KEY)'),
]
for path, marker in checks:
    if marker not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Authoritative TEST timer verification failed: {path} -> {marker}')

if "window.nexusSecureAdoptMiningState?.({\n        miningActive:true,\n        miningStartedAt:effectiveStartedAt" in boost:
    raise SystemExit('TEST boost still overwrites the authoritative mining timestamp')

print('Applied TEST boost authoritative timer guard: local -2H preview stays separate from Firestore claim state and projected NVX.')
