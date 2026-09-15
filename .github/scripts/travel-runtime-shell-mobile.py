#!/usr/bin/env python3
import base64,json,os,subprocess,tempfile,time,urllib.request
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,websocket
ROOT=Path(__file__).resolve().parents[2]/'fresh-rebuild'; PORT=8765; CDP=9222
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
def call(ws,n,m,p=None):
    n[0]+=1; i=n[0]; ws.send(json.dumps({'id':i,'method':m,'params':p or {}}))
    while 1:
        x=json.loads(ws.recv())
        if x.get('id')==i:
            if 'error' in x: raise RuntimeError(x['error'])
            return x.get('result',{})
def ev(ws,n,s): return call(ws,n,'Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':True}).get('result',{}).get('value')
def wait(url,t=30):
    end=time.time()+t
    while time.time()<end:
        try: urllib.request.urlopen(url,timeout=1).read(); return
        except: time.sleep(.4)
    raise RuntimeError('timeout: '+url)
def gate(w,h):
    page=next(x for x in json.load(urllib.request.urlopen(f'http://127.0.0.1:{CDP}/json/list')) if x.get('type')=='page')
    ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=30,origin=f'http://127.0.0.1:{CDP}'); n=[0]
    call(ws,n,'Page.enable'); call(ws,n,'Runtime.enable'); call(ws,n,'Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':1,'mobile':True,'screenWidth':w,'screenHeight':h})
    call(ws,n,'Page.navigate',{'url':f'http://127.0.0.1:{PORT}/index.html?runtime-gate={w}x{h}'})
    end=time.time()+20
    while time.time()<end:
        if ev(ws,n,'Boolean(window.NexusNovaFresh?.openApp)'): break
        time.sleep(.5)
    else: raise RuntimeError(f'{w}x{h}: NexusNovaFresh did not initialize')
    ev(ws,n,"window.NexusNovaFresh.openMine(); true")
    time.sleep(1.2)
    ev(ws,n,"window.NexusNovaFresh.openApp('travel'); true")
    state=None; end=time.time()+12
    while time.time()<end:
        state=ev(ws,n,"""(()=>{const t=document.querySelector('#nx-stage .nxf-travel'),s=t?.closest('#nx-stage>.nx-screen');return {travel:!!t,header:!!s?.querySelector(':scope>.nx-app-head'),context:!!t?.querySelector('[data-smart-travel-context]'),route:document.querySelector('#nx-stage')?.dataset.route}})()""")
        if state and state['travel']: break
        time.sleep(.3)
    if not state or not state['travel']: raise RuntimeError(f'{w}x{h}: real router did not mount Fare Lens; state={state}')
    if state['header']: raise RuntimeError(f'{w}x{h}: obsolete generic Discover header remains')
    if state['context']: raise RuntimeError(f'{w}x{h}: obsolete Smart Travel Context remains')
    result=ev(ws,n,r'''(()=>{const d=document.documentElement,b=document.body,t=document.querySelector('.nxf-travel');const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height}};const V=(s,m)=>{const r=R(document.querySelector(s));return!!r&&r.w>0&&r.h>=m&&r.l>=-.5&&r.r<=innerWidth+.5&&r.t>=-.5&&r.b<=innerHeight+.5};const text=t.innerText;const req=['NEXUSNOVA TRAVEL','Flights','Buses','Trains','Hotels','Trip','Compare before you book.','SEARCH FLIGHTS','Fare Calendar','Disruption Rescue','Flight status'];const bg=[getComputedStyle(t).backgroundColor,getComputedStyle(t.querySelector('.nxf-head')).backgroundColor,getComputedStyle(t.querySelector('.nxf-primary')).backgroundColor];const rgb=s=>{const m=String(s).match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);return m?[+m[1],+m[2],+m[3]]:null};const c=bg.map(rgb).filter(Boolean);return{width:innerWidth,height:innerHeight,docW:d.scrollWidth,bodyW:b.scrollWidth,labels:req.every(x=>text.includes(x)),dark:c.some(([r,g,b])=>Math.max(r,g,b)<80),blue:c.some(([r,g,b])=>b>r*1.12&&b>g*1.08),emerald:c.some(([r,g,b])=>r<30&&g>70&&g>r*2&&g>b*1.25),back:V('.nxf-back',36),pk:V('[data-pk]',36),external:V('[data-browser]',36),origin:V('[data-pick="origin"]',50),destination:V('[data-pick="destination"]',50),swap:V('[data-swap]',30),search:V('[data-search]',40),calendar:V('[data-calendar]',30),rescue:V('[data-rescue]',30),status:V('[data-flight]',30),footer:V('.nxf-footer',1)}})()''')
    ev(ws,n,"document.querySelector('[data-pick=\"destination\"]')?.click(); true"); time.sleep(.4)
    picker=ev(ws,n,"""(()=>{const p=document.querySelector('.nxf-picker'),s=p?.querySelector('.nxf-picker-sheet'),q=p?.querySelector('input'),o=p?.querySelector('[data-options]');const r=e=>e?.getBoundingClientRect();const a=r(s),b=r(q),c=r(o);return{picker:!!p,sheet:!!s,input:!!q,options:!!o,inside:!!a&&a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<=innerHeight,queryInside:!!b&&b.left>=0&&b.right<=innerWidth,optionsInside:!!c&&c.left>=0&&c.right<=innerWidth}})()""")
    ev(ws,n,"document.querySelector('.nxf-picker [data-close]')?.click()")
    ok=bool(result and result['width']==w and result['height']==h and result['docW']<=w and result['bodyW']<=w and result['labels'] and not result['dark'] and not result['blue'] and result['emerald'] and all(result[k] for k in ['back','pk','external','origin','destination','swap','search','calendar','rescue','status','footer']) and picker and all(picker.values()))
    result['picker']=picker; result['ok']=ok; print(f'ANDROID-APP-SHELL {w}x{h}: {"PASS" if ok else "FAIL"} '+json.dumps(result,sort_keys=True))
    if not ok: raise SystemExit(1)
    shot=call(ws,n,'Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data']; Path(os.environ.get('RUNNER_TEMP','/tmp'),f'nexusnova-travel-runtime-{w}x{h}.png').write_bytes(base64.b64decode(shot)); ws.close()
def main():
    srv=ThreadingHTTPServer(('127.0.0.1',PORT),lambda *a,**k:Quiet(*a,directory=str(ROOT),**k)); threading.Thread(target=srv.serve_forever,daemon=True).start(); profile=tempfile.mkdtemp(prefix='nx-runtime-'); chrome=subprocess.Popen(['chromium','--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',f'--user-data-dir={profile}',f'--remote-debugging-port={CDP}','--remote-allow-origins=*','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        wait(f'http://127.0.0.1:{CDP}/json/version')
        for size in ((390,844),(412,915)): gate(*size)
    finally: chrome.terminate(); srv.shutdown()
if __name__=='__main__': main()
