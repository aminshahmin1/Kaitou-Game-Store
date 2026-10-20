import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const base=process.env.AUDIT_BASE_URL??"http://localhost:3100",output=path.resolve("artifacts/rankings-design");await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true}),context=await browser.newContext();await context.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));
const page=await context.newPage(),errors=[],cases=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultNavigationTimeout(90000);
try{
  await page.goto(base+"/leaderboard",{waitUntil:"domcontentloaded"});
  for(const width of [320,390,1024,1440])for(const theme of ["light","dark"]){
    await page.setViewportSize({width,height:960});await page.evaluate(t=>localStorage.setItem("kaitou-theme",t),theme);await page.reload({waitUntil:"domcontentloaded"});await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
    const nav=page.getByRole("navigation",{name:"Game rankings"});await nav.waitFor();
    const tabs=await nav.getByRole("link").allTextContents();assert.ok(tabs.length>=5);for(const tab of tabs)assert.ok(!/[()|]/.test(tab),tab);
    const details=await nav.evaluate(async el=>{const imgs=[...el.querySelectorAll("img")];await Promise.all(imgs.map(img=>img.decode()));const boxes=[...el.children].map(x=>x.getBoundingClientRect());return{scrollable:el.scrollWidth>el.clientWidth+2,overlap:boxes.some((b,i)=>i>0&&boxes[i-1].right>b.left+1),sameRow:boxes.every(b=>Math.abs(b.top-boxes[0].top)<1),images:imgs.every(img=>img.naturalWidth>0)};});
    if(width<600)assert.equal(details.scrollable,true);assert.equal(details.overlap,false);assert.equal(details.sameRow,true);assert.equal(details.images,true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    const colors=await page.locator(".ranking-surface").evaluate(el=>({background:getComputedStyle(el).backgroundColor,foreground:getComputedStyle(el).color,muted:getComputedStyle(el.querySelector(".ranking-muted")).color}));
    assert.equal(colors.background,theme==="light"?"rgb(247, 251, 255)":"rgb(16, 21, 27)");assert.notEqual(colors.foreground,colors.background);
    assert.equal(await page.locator(".ranking-surface footer").evaluate(el=>getComputedStyle(el).backgroundColor),colors.background);
    if(details.scrollable){
      if(await page.getByRole("button",{name:"Previous games",exact:true}).isEnabled()) { await page.getByRole("button",{name:"Previous games",exact:true}).click(); await page.waitForTimeout(450); }
      await page.getByRole("button",{name:"Next games",exact:true}).click();await page.waitForTimeout(450);assert.ok(await nav.evaluate(el=>el.scrollLeft>0));
      await page.getByRole("button",{name:"Previous games",exact:true}).click();await page.waitForTimeout(450);
    }
    cases.push({width,theme,...details,...colors});await page.screenshot({path:path.join(output,`rankings-${width}-${theme}.png`),fullPage:true});console.log(`PASS: ${width}px ${theme} ranking strip, scrolling and theme`);
  }
  const nav=page.getByRole("navigation",{name:"Game rankings"});const genshin=nav.getByRole("link",{name:/Genshin Impact/});await genshin.click();await page.getByRole("heading",{name:"Genshin Impact",exact:true}).waitFor();assert.equal(await page.getByRole("navigation",{name:"Game rankings"}).getByRole("link",{name:/Genshin Impact/}).getAttribute("aria-current"),"page");
  await page.getByRole("navigation",{name:"Game rankings"}).getByRole("link",{name:/Mobile Legends/}).click();await page.getByRole("heading",{name:"Mobile Legends",exact:true}).waitFor();
  const rankingRows=page.locator("tbody tr");assert.ok(await rankingRows.count()<=100);for(const row of await rankingRows.allTextContents())assert.match(row,/\*{4}/);
  await page.screenshot({path:path.join(output,"rankings-populated-dark.png"),fullPage:true});
  await page.getByRole("button",{name:"Change color theme"}).click();assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
  await page.goto(base,{waitUntil:"domcontentloaded"});const cards=page.locator(".topup-product-card");assert.ok(await cards.count()>=5);
  const rains=await page.locator("[data-currency-rain]").evaluateAll(async elements=>{const results=[];for(const el of elements){const imgs=[...el.querySelectorAll("img")];for(const img of imgs)img.loading="eager";await Promise.all(imgs.map(img=>img.decode()));results.push({unit:el.dataset.currencyRain,particles:imgs.length,loaded:imgs.every(img=>img.naturalWidth>0),pointerEvents:getComputedStyle(el).pointerEvents});}return results;});
  assert.ok(rains.length>=5);assert.ok(rains.every(r=>r.particles===16&&r.loaded&&r.pointerEvents==="none"));
  await cards.first().hover();
  const drop=page.locator(".currency-drop").first();const before=await drop.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(220);assert.notEqual(await drop.evaluate(el=>getComputedStyle(el).transform),before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:path.join(output,"topup-rain-light.png"),fullPage:true});
  await page.setViewportSize({width:390,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await page.screenshot({path:path.join(output,"topup-rain-mobile.png"),fullPage:true});await page.setViewportSize({width:1440,height:960});
  await page.getByRole("button",{name:"Change color theme"}).click();await page.screenshot({path:path.join(output,"topup-rain-dark.png"),fullPage:true});
  await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator(".currency-rain").first().evaluate(el=>getComputedStyle(el).display),"none");assert.equal(await drop.evaluate(el=>getComputedStyle(el).animationName),"none");
  await page.emulateMedia({reducedMotion:"no-preference"});await cards.first().click();await page.waitForURL(/\/products\//);assert.equal(await page.getByRole("heading",{level:1}).count(),1);
  assert.deepEqual(errors,[]);await writeFile(path.join(output,"report.json"),JSON.stringify({base,cases,rains,gameSelection:"passed",themeToggle:"passed",rainMotionAndReducedMotion:"passed",cardNavigation:"passed",errors,paidOrdersCreated:0},null,2));
  console.log("PASS: eight ranking width/theme cases, horizontal scrolling/no overlap, currency images, game selection, theme toggle, moving rain/reduced motion and product navigation; no paid orders.");
}finally{await browser.close();}
