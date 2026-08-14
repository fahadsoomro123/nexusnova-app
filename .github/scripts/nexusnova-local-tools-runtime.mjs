import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  geolocation:{latitude:27.9556,longitude:68.6382},
  permissions:['geolocation']
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message||String(e)));
await page.goto('http://127.0.0.1:4173/.runtime-origin.html');
await page.setContent('<!doctype html><html><body><div id="moreMenu"><div class="more-inner"></div></div><main class="main"></main></body></html>');
await page.evaluate(()=>{
  window.nexusAccountId='runtime-local-user';
  window.openMoreTab=()=>{};
  window.switchTab=()=>{};
  const originalSetInterval=window.setInterval.bind(window);
  window.setInterval=(fn,ms,...args)=>originalSetInterval(fn,Math.min(Number(ms)||0,50),...args);
  class MockNotification { static permission='granted'; static async requestPermission(){return 'granted';} constructor(title,opts){(window.__notifications ||= []).push({title,body:opts?.body||''});} }
  Object.defineProperty(window,'Notification',{value:MockNotification,configurable:true});
});
await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current:{temperature_2m:31.2,relative_humidity_2m:55,apparent_temperature:33.1,wind_speed_10m:8.5},daily:{temperature_2m_max:[35],temperature_2m_min:[25],precipitation_probability_max:[20],sunrise:['2026-08-14T06:00'],sunset:['2026-08-14T19:00']}})}));
await page.addScriptTag({url:'http://127.0.0.1:4173/js/nexusnova-mega-merge-v1.js'});
await page.waitForSelector('#tab-mega-tools',{timeout:5000});

await page.fill('#nxMegaCalc','(125*4+20)/2');
await page.click('#nxMegaCalcBtn');
assert.equal((await page.textContent('#nxMegaCalcOut')).trim(),'260');
console.log('PASS Daily Tools calculator');

await page.fill('#nxMegaNoteTitle','Runtime Note');
await page.fill('#nxMegaNoteText','Saved locally');
await page.click('#nxMegaNoteBtn');
assert.match(await page.textContent('#nxMegaNotes'),/Runtime Note/);
await page.fill('#nxMegaTodo','Buy milk');
await page.click('#nxMegaTodoBtn');
assert.match(await page.textContent('#nxMegaTodos'),/Buy milk/);
console.log('PASS Notes and To-Do local persistence');

await page.fill('#nxMegaEvent','School Meeting');
await page.fill('#nxMegaEventDate','2026-08-20T10:00');
await page.click('#nxMegaEventBtn');
assert.match(await page.textContent('#nxMegaEvents'),/School Meeting/);
console.log('PASS Calendar event save/render');

await page.fill('#nxMegaReminder','Runtime Reminder');
await page.fill('#nxMegaReminderDate','2026-08-13T00:00');
await page.click('#nxMegaReminderBtn');
await page.waitForFunction(()=>Array.isArray(window.__notifications)&&window.__notifications.some(x=>x.body==='Runtime Reminder'),null,{timeout:3000});
const reminderStored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nxmega_reminders:runtime-local-user')||'[]'));
assert.equal(reminderStored[0]?.fired,true);
console.log('PASS Reminder storage + due browser notification');

await page.fill('#nxMegaExpense','Groceries');
await page.fill('#nxMegaExpenseAmt','2500');
await page.click('#nxMegaExpenseBtn');
assert.match(await page.textContent('#nxMegaExpenseTotal'),/2,500|2500/);
await page.fill('#nxMegaLoanP','100000');
await page.fill('#nxMegaLoanR','12');
await page.fill('#nxMegaLoanN','12');
await page.click('#nxMegaLoanBtn');
assert.match(await page.textContent('#nxMegaLoanOut'),/Monthly/i);
await page.fill('#nxMegaSplitB','1000');
await page.fill('#nxMegaSplitP','4');
await page.click('#nxMegaSplitBtn');
assert.match(await page.textContent('#nxMegaSplitOut'),/250/);
console.log('PASS Finance expense + EMI + bill split');

await page.fill('#nxMegaSaveName','Laptop');
await page.fill('#nxMegaSaveTarget','100000');
await page.fill('#nxMegaSaveCurrent','25000');
await page.click('#nxMegaSaveBtn');
assert.match(await page.textContent('#nxMegaSavings'),/Laptop/);
console.log('PASS Savings goal');

await page.fill('#nxMegaHabit','Walk');
await page.click('#nxMegaHabitBtn');
assert.match(await page.textContent('#nxMegaHabits'),/Walk/);
await page.click('[data-habit="0"]');
assert.match(await page.textContent('#nxMegaHabits'),/1 check-in/);
console.log('PASS Habit add + daily check-in');

await page.fill('#nxMegaContactName','Ali');
await page.fill('#nxMegaContactPhone','+923001234567');
await page.click('#nxMegaContactBtn');
assert.match(await page.textContent('#nxMegaContacts'),/Ali/);
assert.match(await page.textContent('#nxMegaContacts'),/923001234567/);
console.log('PASS Contacts local save/render');

await page.fill('#nxMegaShopping','Rice');
await page.click('#nxMegaShoppingBtn');
assert.match(await page.textContent('#nxMegaShoppingList'),/Rice/);
console.log('PASS Shopping list');

await page.fill('#nxMegaGrades','80,72,91,65');
await page.click('#nxMegaGradeBtn');
assert.match(await page.textContent('#nxMegaGradeOut'),/Average 77\.00/);
console.log('PASS Teacher grade calculator');

await page.click('#nxMegaWeatherBtn');
await page.waitForFunction(()=>/31\.2/.test(document.getElementById('nxMegaWeatherOut')?.textContent||''),null,{timeout:3000});
assert.match(await page.textContent('#nxMegaWeatherOut'),/31\.2/);
console.log('PASS Weather geolocation + live API render path');

assert.equal(errors.length,0,errors.join('\n'));
console.log('\nLocal tools runtime smoke complete: 11 feature groups passed.');
await browser.close();
