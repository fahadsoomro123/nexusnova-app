#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=qa-artifacts/ai-photo-flagship
PORT=4174
mkdir -p "$OUT_DIR"

CHROME=
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROME=$(command -v "$candidate"); break; fi
done
test -n "$CHROME" || { echo '::error::Chrome/Chromium is required.' >&2; exit 1; }

CHROMEDRIVER=
for candidate in chromedriver google-chrome-chromedriver; do
  if command -v "$candidate" >/dev/null 2>&1; then CHROMEDRIVER=$(command -v "$candidate"); break; fi
done
if [ -z "$CHROMEDRIVER" ]; then
  for candidate in /usr/local/share/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver; do
    if [ -x "$candidate" ]; then CHROMEDRIVER="$candidate"; break; fi
  done
fi
test -n "$CHROMEDRIVER" || { echo '::error::ChromeDriver is required.' >&2; exit 1; }

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory . >"$OUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/tools/ai-photo-flagship-qa/harness.html" >/dev/null; then break; fi
  sleep 1
done
node tools/ai-photo-flagship-qa/behavior-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
node tools/ai-photo-flagship-qa/design-editor-qa.mjs "$CHROME" "$CHROMEDRIVER" "$PORT" "$OUT_DIR"
