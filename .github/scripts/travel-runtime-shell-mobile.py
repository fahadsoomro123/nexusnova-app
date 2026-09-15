#!/usr/bin/env python3
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import websocket

ROOT = Path(__file__).resolve().parents[2] / 'fresh-rebuild'
PORT = 8765
CDP = 9222

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def cdp_call(ws, seq, method, params=None):
    seq[0] += 1
    ident = seq[0]
    ws.send(json.dumps({'id': ident, 'method': method, 'params': params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get('id') == ident:
            if 'error' in msg:
                raise RuntimeError(msg['error'])
            return msg.get('result', {})


def evaluate(ws, seq, expression):
    result = cdp_call(ws, seq, 'Runtime.evaluate', {
        'expression': expression,
        'returnByValue': True,
        'awaitPromise': True,
    })
    return result.get('result', {}).get('value')


def wait_for(url, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=1).read()
            return
        except Exception:
            time.sleep(.5)
    raise RuntimeError(f'timeout waiting for {url}')


def run_gate(chrome, width, height):
    pages = json.load(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json/list'))
    page = next(p for p in pages if p.get('type') == 'page')
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=30, origin=f'http://127.0.0.1:{CDP}')
    seq = [0]
    cdp_call(ws, seq, 'Page.enable')
    cdp_call(ws, seq, 'Runtime.enable')
    cdp_call(ws, seq, 'Emulation.setDeviceMetricsOverride', {
        'width': width, 'height': height, 'deviceScaleFactor': 1,
        'mobile': True, 'screenWidth': width, 'screenHeight': height,
    })
    cdp_call(ws, seq, 'Page.navigate', {'url': f'http://127.0.0.1:{PORT}/index.html?runtime-gate={width}x{height}'})

    ready = None
    end = time.time() + 18
    while time.time() < end:
        ready = evaluate(ws, seq, 'Boolean(window.NexusNovaFresh && window.NexusNovaFresh.openApp)')
        if ready: break
        time.sleep(.5)
    if not ready:
        raise RuntimeError(f'{width}x{height}: NexusNovaFresh runtime API did not initialize')

    evaluate(ws, seq, "window.NexusNovaFresh.openApp('travel')")
    end = time.time() + 10
    state = None
    while time.time() < end:
        state = evaluate(ws, seq, """(()=>{
          const t=document.querySelector('.nxf-travel');
          const screen=t?.closest('#nx-stage > .nx-screen');
          return {travel:!!t,screen:!!screen,header:!!screen?.querySelector(':scope > .nx-app-head'),context:!!t?.querySelector('[data-smart-travel-context]')};
        })()""")
        if state and state['travel'] and not state['header'] and not state['context']: break
        time.sleep(.3)
    if not state or not state.get('travel'):
        raise RuntimeError(f'{width}x{height}: real router did not mount Fare Lens')
    if state.get('header'):
        raise RuntimeError(f'{width}x{height}: obsolete generic app/Discover header is still mounted')
    if state.get('context'):
        raise RuntimeError(f'{width}x{height}: obsolete blue Smart Travel Context is still mounted')

    js = r'''(()=>{
      const d=document.documentElement,b=document.body,t=document.querySelector('.nxf-travel');
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const visible=(sel,minH=1)=>{const e=document.querySelector(sel);const r=rect(e);return !!r&&r.width>0&&r.height>=minH&&r.left>=-0.5&&r.right<=innerWidth+0.5&&r.top>=-0.5&&r.bottom<=innerHeight+0.5};
      const text=t?.innerText||'';
      const required=['NEXUSNOVA TRAVEL','Flights','Buses','Trains','Hotels','Trip','Compare before you book.','SEARCH FLIGHTS','Fare Calendar','Disruption Rescue','Flight status'];
      const bg=[getComputedStyle(t).backgroundColor,getComputedStyle(t.querySelector('.nxf-head')).backgroundColor,getComputedStyle(t.querySelector('.nxf-tabs')).backgroundColor,getComputedStyle(t.querySelector('.nxf-primary')).backgroundColor];
      const rgb=s=>{const m=String(s).match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);return m?[+m[1],+m[2],+m[3]]:null};
      const colors=bg.map(rgb).filter(Boolean); const dark=colors.some(([r,g,b])=>Math.max(r,g,b)<80); const blue=colors.some(([r,g,b])=>b>r*1.12&&b>g*1.08); const emerald=colors.some(([r,g,b])=>r<30&&g>70&&g>r*2&&g>b*1.25);
      return {width:innerWidth,height:innerHeight,docW:d.scrollWidth,bodyW:b.scrollWidth,labels:required.every(x=>text.includes(x)),dark,blue,emerald,
        back:visible('.nxf-back',36),pk:visible('[data-pk]',36),external:visible('[data-browser]',36),tabs:[...document.querySelectorAll('.nxf-tabs button')].every(e=>visible('.nxf-tabs button',34)),
        origin:visible('[data-pick="origin"]',50),destination:visible('[data-pick="destination"]',50),swap:visible('[data-swap]',30),search:visible('[data-search]',40),
        calendar:visible('[data-calendar]',30),rescue:visible('[data-rescue]',30),statusInput:visible('[data-flight]',30),footer:visible('.nxf-footer',1),
        root:rect(t),stage:rect(document.querySelector('#nx-stage'))};
    })()'''
    result = evaluate(ws, seq, js)
    ok = (
        result and result['width'] == width and result['height'] == height and
        result['docW'] <= width and result['bodyW'] <= width and result['labels'] and
        result['back'] and result['pk'] and result['external'] and result['tabs'] and
        result['origin'] and result['destination'] and result['swap'] and result['search'] and
        result['calendar'] and result['rescue'] and result['statusInput'] and result['footer'] and
        not result['dark'] and not result['blue'] and result['emerald']
    )

    # Exercise the real picker created by the real Travel renderer.
    picker = evaluate(ws, seq, "document.querySelector('[data-pick=\"destination\"]')?.click(); true")
    time.sleep(.4)
    pick_result = evaluate(ws, seq, """(()=>{
      const p=document.querySelector('.nxf-picker'),s=p?.querySelector('.nxf-picker-sheet'),q=p?.querySelector('[data-q]'),rows=p?.querySelector('[data-options]');
      const r=e=>e?e.getBoundingClientRect():null;
      const pr=r(p),sr=r(s),qr=r(q),rr=r(rows);
      return {picker:!!p,sheet:!!s,input:!!q,options:!!rows,inside:!!sr&&sr.left>=0&&sr.right<=innerWidth&&sr.top>=0&&sr.bottom<=innerHeight,queryInside:!!qr&&qr.left>=0&&qr.right<=innerWidth,optionsInside:!!rr&&rr.left>=0&&rr.right<=innerWidth};
    })()""")
    evaluate(ws, seq, "document.querySelector('.nxf-picker [data-close]')?.click()")
    picker_ok = bool(pick_result and all(pick_result.get(k) for k in ['picker','sheet','input','options','inside','queryInside','optionsInside']))
    result['picker'] = pick_result
    result['picker_ok'] = picker_ok
    ok = ok and picker_ok

    print(f'ANDROID-APP-SHELL {width}x{height}: {"PASS" if ok else "FAIL"} {json.dumps(result, sort_keys=True)}')
    if not ok:
        raise SystemExit(1)
    shot = cdp_call(ws, seq, 'Page.captureScreenshot', {'format':'png','captureBeyondViewport':False})
    out = Path(os.environ.get('RUNNER_TEMP','/tmp')) / f'nexusnova-travel-runtime-{width}x{height}.png'
    out.write_bytes(base64.b64decode(shot['data']))
    ws.close()
    return out


def main():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), lambda *args, **kwargs: Quiet(*args, directory=str(ROOT), **kwargs))
    import threading
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = tempfile.mkdtemp(prefix='nexusnova-runtime-chrome-')
    chrome = subprocess.Popen(['chromium','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--user-data-dir={profile}',f'--remote-debugging-port={CDP}','--remote-allow-origins=*','about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_for(f'http://127.0.0.1:{CDP}/json/version')
        for size in ((390,844),(412,915)):
            run_gate(chrome, *size)
    finally:
        chrome.terminate(); server.shutdown()

if __name__ == '__main__':
    main()
