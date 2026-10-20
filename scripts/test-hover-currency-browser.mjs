import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const base=process.env.AUDIT_BASE_URL??"http://localhost:3100",output=path.resolve("artifacts/hover-currency");await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext();await context.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));
const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultNavigationTimeout(90000);
const idle=()=>page.locator(".currency-drop").evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==="none"));
try{
  for(const theme of ["light","dark"]){
    await page.setViewportSize({width:1440,height:960});await page.goto(base,{waitUntil:"domcontentloaded"});await page.evaluate(t=>localStorage.setItem("kaitou-theme",t),theme);await page.reload({waitUntil:"domcontentloaded"});await page.mouse.move(0,0);
    const card=page.locator(".topup-product-card").filter({hasText:"Genshin Impact"});await card.waitFor();assert.equal(await idle(),true);
    await card.hover();await page.waitForTimeout(250);
    const state=await card.evaluate(async el=>{const rain=el.querySelector(".currency-rain"),poster=el.querySelector("[data-product-poster]"),imgs=[...el.querySelectorAll("img")];for(const img of imgs)img.loading="eager";await Promise.all(imgs.map(img=>img.decode()));return{rainZ:Number(getComputedStyle(rain).zIndex),posterZ:Number(getComputedStyle(poster).zIndex),opacity:getComputedStyle(rain).opacity,moving:[...rain.children].every(drop=>getComputedStyle(drop).animationName==="currency-fall"),loaded:imgs.every(img=>img.naturalWidth>0),particles:rain.children.length};});
    assert.ok(state.posterZ>state.rainZ);assert.equal(state.moving,true);assert.equal(state.opacity,"1");assert.equal(state.loaded,true);assert.equal(state.particles,16);
    assert.equal(await page.locator(".topup-product-card").filter({hasNotText:"Genshin Impact"}).locator(".currency-drop").evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==="none")),true);
    const first=card.locator(".currency-drop").first(),before=await first.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(180);assert.notEqual(await first.evaluate(el=>getComputedStyle(el).transform),before);
    await card.screenshot({path:path.join(output,`genshin-hover-${theme}.png`)});
    await page.mouse.move(0,0);await page.waitForTimeout(200);assert.equal(await idle(),true);assert.equal(await card.locator(".currency-rain").evaluate(el=>getComputedStyle(el).opacity),"0");
    await page.keyboard.press("Tab");await card.focus();assert.equal(await card.evaluate(el=>el.matches(":focus-visible")),true);assert.equal(await first.evaluate(el=>getComputedStyle(el).animationName),"currency-fall");
    await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await card.locator(".currency-rain").evaluate(el=>getComputedStyle(el).display),"none");assert.equal(await idle(),true);await page.emulateMedia({reducedMotion:"no-preference"});await card.evaluate(el=>el.blur());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  }
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await touch.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));const mobile=await touch.newPage();await mobile.goto(base,{waitUntil:"domcontentloaded"});await mobile.locator(".topup-product-card").first().waitFor();assert.equal(await mobile.locator(".currency-drop").evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==="none")),true);await touch.close();
  assert.deepEqual(errors,[]);await writeFile(path.join(output,"report.json"),JSON.stringify({base,idle:"no animations",hover:"only selected card",layering:"rain behind artwork",themes:2,keyboardFocus:"passed",reducedMotion:"passed",touchIdle:"passed",errors,paidOrdersCreated:0},null,2));
  console.log("PASS: idle stopped, selected-card-only hover, rain behind logo, moving particles, both themes, keyboard focus, reduced motion and touch idle; no orders.");
}finally{await browser.close();}
