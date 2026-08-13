/* NexusNova All-in-One Utilities V1 */
(()=>{const $=id=>document.getElementById(id),store=(k,v)=>localStorage.setItem('nexus_'+k,JSON.stringify(v)),load=(k,d)=>{try{return JSON.parse(localStorage.getItem('nexus_'+k))??d}catch{return d}};const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
window.nxComing=n=>alert(n+' is reserved for the live-integration phase. No fake data or fake tickets will be shown.');
let calc='';
function nxCalculateArithmetic(expression){
  const compact=String(expression||'').replace(/\s+/g,'');
  if(!compact||compact.length>120)throw new Error('Invalid expression');
  const tokens=compact.match(/(?:\d+(?:\.\d+)?|\.\d+|[()+\-*/%])/g)||[];
  if(tokens.join('')!==compact)throw new Error('Invalid expression');
  let cursor=0;
  const peek=()=>tokens[cursor];
  const take=()=>tokens[cursor++];
  const factor=()=>{
    const token=take();
    if(token==='+')return factor();
    if(token==='-')return -factor();
    if(token==='('){const value=expressionValue();if(take()!==')')throw new Error('Invalid expression');return value}
    if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token||''))throw new Error('Invalid expression');
    return Number(token);
  };
  const term=()=>{
    let value=factor();
    while(['*','/','%'].includes(peek())){
      const operator=take(),right=factor();
      if((operator==='/'||operator==='%')&&right===0)throw new Error('Invalid expression');
      value=operator==='*'?value*right:operator==='/'?value/right:value%right;
    }
    return value;
  };
  const expressionValue=()=>{
    let value=term();
    while(['+','-'].includes(peek())){const operator=take(),right=term();value=operator==='+'?value+right:value-right}
    return value;
  };
  const value=expressionValue();
  if(cursor!==tokens.length||!Number.isFinite(value))throw new Error('Invalid expression');
  return value;
}
function nxSetCalcDisplay(display,value){if(!display)return;if('value' in display)display.value=value;else display.textContent=value}
window.nxCalc=v=>{const d=$('calcDisplay');if(!d)return;if(v==='C'){calc='';nxSetCalcDisplay(d,'');return}if(v==='⌫'){calc=calc.slice(0,-1);nxSetCalcDisplay(d,calc);return}if(v==='='){try{calc=String(nxCalculateArithmetic(calc));nxSetCalcDisplay(d,calc)}catch{nxSetCalcDisplay(d,'Error');calc=''}return}calc+=String(v??'');nxSetCalcDisplay(d,calc)};
const units={length:{m:1,km:1000,cm:.01,mm:.001,ft:.3048,yd:.9144,mi:1609.344},weight:{kg:1,g:.001,lb:.45359237,oz:.0283495235},data:{B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776}};function fillUnits(){let ty=$('unitType'),f=$('unitFrom'),t=$('unitTo');if(!ty||!f||!t)return;let k=ty.value==='temperature'?['C','F','K']:Object.keys(units[ty.value]);f.innerHTML=t.innerHTML=k.map(x=>`<option>${x}</option>`).join('');if(k.includes('km')){f.value='km';t.value='m'}else if(k.includes('kg')){f.value='kg';t.value='lb'}else if(k.includes('MB')){f.value='MB';t.value='GB'}else{f.value='C';t.value='F'}unitConvert()}function unitConvert(){let ty=$('unitType')?.value,a=+$('unitAmount')?.value,f=$('unitFrom')?.value,t=$('unitTo')?.value,r=$('unitResult');if(!r||!Number.isFinite(a))return;let out;if(ty==='temperature'){let c=f==='C'?a:f==='F'?(a-32)*5/9:a-273.15;out=t==='C'?c:t==='F'?c*9/5+32:c+273.15}else out=a*(units[ty][f]/units[ty][t]);r.textContent=`${out.toLocaleString(undefined,{maximumFractionDigits:8})} ${t}`}['unitType','unitAmount','unitFrom','unitTo'].forEach(id=>$(id)?.addEventListener(id==='unitType'?'change':'input',id==='unitType'?fillUnits:unitConvert));$('unitFrom')?.addEventListener('change',unitConvert);$('unitTo')?.addEventListener('change',unitConvert);fillUnits();
function clocks(){[['clockPK','Asia/Karachi'],['clockDE','Europe/Berlin'],['clockUK','Europe/London'],['clockAE','Asia/Dubai'],['clockNY','America/New_York']].forEach(([id,tz])=>{let e=$(id);if(e)e.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())})}clocks();setInterval(clocks,1000);
let notes=load('notes',[]);window.nxAddNote=()=>{let i=$('noteInput'),v=i?.value.trim();if(!v)return;notes.unshift({id:Date.now(),text:v});store('notes',notes);i.value='';nxRenderNotes()};window.nxRenderNotes=()=>{let b=$('notesList'),q=($('noteSearch')?.value||'').toLowerCase();if(b)b.innerHTML=notes.filter(n=>n.text.toLowerCase().includes(q)).map(n=>`<div class="saved-item"><span>${esc(n.text)}</span><button onclick="nxDeleteNote(${n.id})">✕</button></div>`).join('')||'<div class="tool-muted">No notes yet.</div>'};window.nxDeleteNote=id=>{notes=notes.filter(n=>n.id!==id);store('notes',notes);nxRenderNotes()};nxRenderNotes();
let todos=load('todos',[]);window.nxAddTodo=()=>{let i=$('todoInput'),v=i?.value.trim();if(!v)return;todos.push({id:Date.now(),text:v,done:false});store('todos',todos);i.value='';nxRenderTodos()};window.nxToggleTodo=id=>{let t=todos.find(x=>x.id===id);if(t)t.done=!t.done;store('todos',todos);nxRenderTodos()};window.nxDeleteTodo=id=>{todos=todos.filter(x=>x.id!==id);store('todos',todos);nxRenderTodos()};function nxRenderTodos(){let b=$('todoList');if(b)b.innerHTML=todos.map(t=>`<div class="saved-item ${t.done?'done':''}"><span onclick="nxToggleTodo(${t.id})">${esc(t.text)}</span><button onclick="nxDeleteTodo(${t.id})">✕</button></div>`).join('')||'<div class="tool-muted">No tasks yet.</div>'}nxRenderTodos();
let focus=1500,timer=null;function draw(){let e=$('focusTime');if(e)e.textContent=`${String(Math.floor(focus/60)).padStart(2,'0')}:${String(focus%60).padStart(2,'0')}`}window.nxFocusStart=()=>{if(timer)return;timer=setInterval(()=>{if(focus<=0){clearInterval(timer);timer=null;alert('Focus session complete 🎉');return}focus--;draw()},1000)};window.nxFocusPause=()=>{clearInterval(timer);timer=null};window.nxFocusReset=()=>{nxFocusPause();focus=1500;draw()};draw();
window.nxSalaryPlan=()=>{let i=+$('salaryIncome')?.value||0,f=+$('salaryFixed')?.value||0,s=+$('salarySave')?.value||0,r=$('salaryResult');r.textContent=i>0?`Fixed: ${f.toLocaleString()} • Savings: ${s.toLocaleString()} • Free: ${(i-f-s).toLocaleString()}`:'Enter salary.'};let expenses=load('expenses',[]);window.nxAddExpense=()=>{let n=$('expenseName')?.value.trim(),a=+$('expenseAmount')?.value||0;if(!n||a<=0)return;expenses.unshift({id:Date.now(),n,a});store('expenses',expenses);$('expenseName').value='';$('expenseAmount').value='';renderExpenses()};function renderExpenses(){let total=expenses.reduce((s,x)=>s+x.a,0),r=$('expenseSummary'),l=$('moneyExpenseList');if(r)r.textContent=`Total: ${total.toLocaleString()}`;if(l)l.innerHTML=expenses.map(x=>`<div class="saved-item"><span>${esc(x.n)}</span><strong>${x.a.toLocaleString()}</strong></div>`).join('')||'<div class="tool-muted">No expenses yet.</div>'}renderExpenses();
window.nxEMI=()=>{let p=+$('emiPrincipal')?.value||0,a=+$('emiRate')?.value||0,n=+$('emiMonths')?.value||0,r=$('emiResult');if(p<=0||n<=0){r.textContent='Enter loan amount and months.';return}let m=a/1200,emi=m?p*m*Math.pow(1+m,n)/(Math.pow(1+m,n)-1):p/n;r.textContent=`Monthly EMI: ${emi.toLocaleString(undefined,{maximumFractionDigits:2})}`};window.nxSplitBill=()=>{let b=+$('moneyBillAmount')?.value||0,t=+$('tipPercent')?.value||0,p=+$('peopleCount')?.value||0,r=$('splitResult');if(b<=0||p<=0){r.textContent='Enter bill and people.';return}let total=b*(1+t/100);r.textContent=`Total: ${total.toLocaleString(undefined,{maximumFractionDigits:2})} • Each: ${(total/p).toLocaleString(undefined,{maximumFractionDigits:2})}`};window.nxBMI=()=>{let w=+$('healthBmiWeight')?.value||0,h=+$('healthBmiHeight')?.value||0,r=$('healthBmiResult');if(w<=0||h<=0){r.textContent='Enter weight and height.';return}let bmi=w/((h/100)**2);r.textContent=`BMI ${bmi.toFixed(1)} • ${bmi<18.5?'Underweight':bmi<25?'Normal range':bmi<30?'Overweight':'Obesity range'}`};window.nxWater=()=>{let w=+$('waterWeight')?.value||0;r=$('waterResult');r.textContent=w>0?`Estimated daily water: ${(w*35/1000).toFixed(2)} L`:'Enter weight.'};window.nxSleep=()=>{let v=$('sleepWake')?.value||'07:00',r=$('sleepResult'),[h,m]=v.split(':').map(Number),d=new Date();d.setHours(h,m,0,0);d.setMinutes(d.getMinutes()-450);r.textContent=`Suggested bedtime: ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`};

/* Money-tab currency converter. This is intentionally separate from the
   Finance-tab convertCurrency() implementation so the two UIs cannot
   overwrite each other's handlers. */
const MONEY_FX_CACHE_KEY='nexusnova_money_fx_cache_v1';
const MONEY_FX_SHARED_CACHE_KEY='nexusnova_fx_cache_v1';
const MONEY_FX_CODES=['USD','PKR','EUR','GBP','AED','SAR','INR','JPY','CAD','AUD','CNY','CHF','TRY','BDT','LKR','NPR','SGD','MYR','THB','IDR','KRW','NZD','ZAR'];
let moneyFxRates=null,moneyFxPending=null;
function moneyFxUsable(rates){return !!rates&&MONEY_FX_CODES.slice(0,10).every(c=>Number(rates[c])>0)}
function moneyFxReadCache(){
  for(const key of [MONEY_FX_SHARED_CACHE_KEY,MONEY_FX_CACHE_KEY]){
    try{
      const raw=JSON.parse(localStorage.getItem(key)||'null');
      const rates=raw?.rates||raw;
      if(moneyFxUsable(rates)) return rates;
    }catch{}
  }
  return null;
}
function moneyFxSave(rates){try{localStorage.setItem(MONEY_FX_CACHE_KEY,JSON.stringify({time:Date.now(),rates}))}catch{}}
async function moneyFxFetchJson(url,timeoutMs=9000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok) throw new Error('HTTP '+response.status);
    return await response.json();
  }finally{clearTimeout(timer)}
}
async function moneyFxFetch(){
  if(moneyFxUsable(moneyFxRates)) return moneyFxRates;
  const cached=moneyFxReadCache();
  if(cached){moneyFxRates=cached;return cached}
  if(moneyFxPending) return moneyFxPending;
  moneyFxPending=(async()=>{
    let lastError=null;
    try{
      const data=await moneyFxFetchJson('https://open.er-api.com/v6/latest/USD');
      const rates=Object.assign({USD:1},data?.rates||{});
      if(!moneyFxUsable(rates)) throw new Error('Open FX response is incomplete');
      moneyFxRates=rates;moneyFxSave(rates);return rates;
    }catch(error){lastError=error;console.warn('Money converter primary FX source failed:',error)}
    try{
      const data=await moneyFxFetchJson('https://api.frankfurter.dev/v2/rates?base=USD');
      const rates={USD:1};
      if(Array.isArray(data)) data.forEach(row=>{const code=String(row?.quote||'').toUpperCase(),rate=Number(row?.rate);if(code&&Number.isFinite(rate)&&rate>0)rates[code]=rate});
      if(!moneyFxUsable(rates)) throw new Error('Frankfurter response is incomplete');
      moneyFxRates=rates;moneyFxSave(rates);return rates;
    }catch(error){lastError=error;console.warn('Money converter fallback FX source failed:',error)}
    throw lastError||new Error('Currency rates unavailable');
  })().finally(()=>{moneyFxPending=null});
  return moneyFxPending;
}
function moneyFxRender(){
  const amount=Number($('currencyAmount')?.value),from=$('currencyFrom')?.value,to=$('currencyTo')?.value;
  const out=$('currencyResult'),status=$('currencyStatus');
  if(!out||!status) return;
  if(!moneyFxUsable(moneyFxRates)){status.textContent='Loading live rates…';moneyFxFetch().then(moneyFxRender).catch(()=>{out.textContent='—';status.textContent='Live rates unavailable — tap Convert to retry.'});return}
  if(!Number.isFinite(amount)){out.textContent='—';status.textContent='Enter an amount.';return}
  const a=Number(moneyFxRates[from]),b=Number(moneyFxRates[to]);
  if(!(a>0&&b>0)){out.textContent='—';status.textContent='Selected currency is unavailable.';return}
  const converted=(amount/a)*b;
  out.textContent=`${amount.toLocaleString()} ${from} = ${converted.toLocaleString(undefined,{maximumFractionDigits:4})} ${to}`;
  status.textContent='Live exchange rates';
}
function moneyFxInit(){
  const from=$('currencyFrom'),to=$('currencyTo'),btn=$('convertCurrencyBtn');
  if(!from||!to||!btn) return;
  const options=MONEY_FX_CODES.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(!from.options.length) from.innerHTML=options;
  if(!to.options.length) to.innerHTML=options;
  from.value='USD';to.value='PKR';
  btn.addEventListener('click',moneyFxRender);
  $('currencyAmount')?.addEventListener('input',()=>{if(moneyFxUsable(moneyFxRates))moneyFxRender()});
  from.addEventListener('change',moneyFxRender);to.addEventListener('change',moneyFxRender);
  const cached=moneyFxReadCache();if(cached)moneyFxRates=cached;
  moneyFxRender();
}
moneyFxInit();
})();
