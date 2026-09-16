import {test,expect} from '@playwright/test';
const routes=['home','mission','projects','build','selfheal','artifacts','history','verification','github','security'];
const viewports=[{width:360,height:800},{width:360,height:900},{width:390,height:844},{width:412,height:915}];
for(const viewport of viewports){
  test(`responsive contract ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('./#home');
    await expect(page.locator('h1')).toContainText('Direct the engineering mission');
    const metrics=await page.evaluate(()=>({
      bodyScrollWidth:document.body.scrollWidth,
      bodyClientWidth:document.body.clientWidth,
      bodyScrollHeight:document.body.scrollHeight,
      bodyClientHeight:document.body.clientHeight,
      interactive:[...document.querySelectorAll('button,a,input,select,textarea')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,w:r.width,h:r.height,font:parseFloat(getComputedStyle(el).fontSize)}})
    }));
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth);
    expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight);
    for(const el of metrics.interactive){expect(el.w,`${el.tag} width`).toBeGreaterThanOrEqual(44);expect(el.h,`${el.tag} height`).toBeGreaterThanOrEqual(44)}
  });
}
for(const route of routes){
  test(`render screenshot ${route}`,async({page})=>{
    await page.setViewportSize({width:640,height:1200});
    await page.goto(`./#${route}`);
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({path:`../../screenshots/${route==='selfheal'?'self-heal':route}.png`,scale:'css'});
  });
}
test('state machine reaches failure and recovery states without falsely verifying',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./#home');
  await page.locator('#command').fill('Build APK');
  await page.locator('[data-command-run]').click();
  for(let i=0;i<4;i++){await page.locator('[data-advance]').first().click()}
  await expect(page.locator('.status.error')).toContainText('Failed');
  for(let i=0;i<3;i++){await page.locator('[data-advance]').first().click()}
  await page.locator('[data-nav="verification"]').click();
  await expect(page.locator('.notice.danger-note')).toContainText('VERIFIED is intentionally withheld');
});
