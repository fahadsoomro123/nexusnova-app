import {test,expect} from '@playwright/test';
const viewports=[{width:360,height:800},{width:360,height:900},{width:390,height:844},{width:412,height:915},{width:1280,height:900}];
for(const viewport of viewports){
  test(`instrument preview ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('./preview.html');
    await expect(page.locator('#instrument')).toBeVisible();
    await expect(page.locator('.command-aperture')).toBeVisible();
    await expect(page.locator('.mission-field')).toBeVisible();
    await expect(page.locator('.spine')).toBeVisible();
    await expect(page.locator('.evidence-field')).toBeVisible();
    const metrics=await page.evaluate(()=>({bodyScrollWidth:document.body.scrollWidth,bodyClientWidth:document.body.clientWidth,bodyScrollHeight:document.body.scrollHeight,bodyClientHeight:document.body.clientHeight,interactive:[...document.querySelectorAll('button,input')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,w:r.width,h:r.height,font:parseFloat(getComputedStyle(el).fontSize)}})}));
    expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth);
    expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight);
    for(const el of metrics.interactive){expect(el.w,`${el.tag} width`).toBeGreaterThanOrEqual(44);expect(el.h,`${el.tag} height`).toBeGreaterThanOrEqual(44)}
  });
}
for(const [name,width,height] of [['desktop',1280,900],['mobile-360x800',360,800],['mobile-390x844',390,844]]){
  test(`render actual design preview ${name}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('./preview.html');
    await page.screenshot({path:`../../screenshots/veytrix-preview-${name}.png`,fullPage:false,scale:'css'});
  });
}
test('preview command and state flow are live',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./preview.html');
  await page.locator('#cmd').fill('Build APK');
  await page.locator('#run').click();
  await expect(page.locator('#state')).toHaveText('PLANNING');
  await page.locator('#advance').click();
  await expect(page.locator('#state')).toHaveText('IMPLEMENTING');
  await page.locator('#advance').click();
  await expect(page.locator('#state')).toHaveText('BUILDING');
});
