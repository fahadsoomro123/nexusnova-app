#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=qa-artifacts/ai-photo-locked-render
PORT=4173
mkdir -p "$OUT_DIR"
PROFILE_ROOT=$(mktemp -d)

CHROME=
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME=$(command -v "$candidate")
    break
  fi
done
if [ -z "$CHROME" ]; then
  echo '::error::Chrome/Chromium is required for rendered visual QA.' >&2
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory . >"$OUT_DIR/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true; rm -rf "$PROFILE_ROOT"' EXIT

ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/tools/ai-photo-locked-visual/harness.html" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo '::error::Visual QA server did not become ready.' >&2
  exit 1
fi

chrome() {
  "$CHROME" \
    --headless=new \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-background-networking \
    --disable-default-apps \
    --disable-extensions \
    --disable-features=Translate \
    --force-color-profile=srgb \
    --force-device-scale-factor=1 \
    --hide-scrollbars \
    --run-all-compositor-stages-before-draw \
    --virtual-time-budget=3000 \
    "$@"
}

status=0
for size in 360x640 360x740 393x852 415x858 430x865; do
  IFS=x read -r width height <<<"$size"
  for screen in home generator; do
    base="$OUT_DIR/$screen-$size"
    url="http://127.0.0.1:$PORT/tools/ai-photo-locked-visual/harness.html?screen=$screen"
    if ! chrome \
      --user-data-dir="$PROFILE_ROOT/chrome-$screen-$size-shot" \
      --window-size="$width,$height" \
      --screenshot="$base.png" \
      "$url" >/dev/null 2>&1; then
      echo "::error::$screen $size screenshot render failed." >&2
      status=1
      continue
    fi
    if ! chrome \
      --user-data-dir="$PROFILE_ROOT/chrome-$screen-$size-dom" \
      --window-size="$width,$height" \
      --dump-dom \
      "$url" >"$base.html" 2>"$base.chrome.log"; then
      echo "::error::$screen $size DOM render failed." >&2
      status=1
      continue
    fi
    if ! node - "$base.html" "$base.json" "$screen" "$size" <<'NODE'
const fs=require('fs');
const [htmlPath,jsonPath,screen,size]=process.argv.slice(2);
const html=fs.readFileSync(htmlPath,'utf8');
const match=html.match(/<script[^>]*id="qa-metrics"[^>]*>([\s\S]*?)<\/script>/);
if(!match)throw new Error(screen+' '+size+': qa-metrics payload missing');
const report=JSON.parse(match[1]);
fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');
if(!report.pass){
  console.error('::error::'+screen+' '+size+' rendered QA failed: '+report.errors.join('; '));
  process.exit(1);
}
console.log('RENDER PASS — '+screen+' '+size+'; '+JSON.stringify(report.viewport));
NODE
    then
      status=1
    fi
  done
done

find "$OUT_DIR" -maxdepth 1 -type f -name '*.json' -print -exec sed -n '1,30p' {} \;
if [ "$status" -ne 0 ]; then
  echo '::error::One or more actual rendered viewport checks failed.' >&2
  exit "$status"
fi
echo 'Rendered visual QA PASS — Home and Generator fit all five Android viewport contracts.'
