import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const base=process.env.AUDIT_BASE_URL??"http://localhost:3100",output=path.resolve("artifacts/steam-curation");await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true}),context=await browser.newContext();await context.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));
const page=await context.newPage(),errors=[],cases=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultNavigationTimeout(90000);
try{
  for(const width of process.env.AUDIT_CURATION_SMOKE==="1"?[390]:[320,390,1440])for(const theme of ["light","dark"]){
    await page.setViewportSize({width,height:960});await page.goto(base,{waitUntil:"domcontentloaded"});await page.evaluate(t=>localStorage.setItem("kaitou-theme",t),theme);await page.reload({waitUntil:"domcontentloaded"});
    for(const route of ["/","/steam-gifts","/steam-gifts?collection=action"]){
      if(route!=="/")await page.goto(base+route,{waitUntil:"domcontentloaded"});await page.getByRole("main").waitFor();
      const area=route==="/"?page.getByRole("region",{name:"Featured Steam Gifts"}):page.getByRole("main");
      const tiles=area.locator(".steam-game-link");assert.ok(await tiles.count()>=1);if(route==="/")assert.equal(await tiles.count(),8);
      const images=await tiles.locator("img").evaluateAll(async imgs=>{for(const img of imgs)img.loading="eager";await Promise.all(imgs.map(img=>img.decode().catch(()=>{})));return imgs.every(img=>img.naturalWidth>0);});assert.equal(images,true,`${route} images`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${width} ${route} overflow`);
      const html=await page.content();for(const field of ["costUsd","cost_usd","fazercardsSku","FAZERCARDS_API_KEY"])assert.ok(!html.includes(field));assert.ok(!/500 best.sell|top 500 best.sell/i.test(await area.textContent()));
      if(route!=="/")assert.equal(await page.locator('[name="collection"] option').count(),10);
      cases.push({width,theme,route,tiles:await tiles.count()});await page.screenshot({path:path.join(output,`${route.replace(/\W+/g,"-")||"home"}-${width}-${theme}.png`),fullPage:true});if(route==="/")await area.screenshot({path:path.join(output,`featured-${width}-${theme}.png`)});console.log(`PASS: ${route} ${width}px ${theme}`);
    }
  }
  await page.goto(base+"/steam-gifts?collection=action",{waitUntil:"domcontentloaded"});
  const next=page.getByRole("link",{name:"Next",exact:true});if(await next.count()){const url=new URL(await next.getAttribute("href"),base);assert.equal(url.searchParams.get("collection"),"action");await next.click();assert.equal(await page.locator('[name="collection"]').inputValue(),"action");}
  await page.locator('[name="q"]').fill("God of War");await page.getByRole("button",{name:"Search",exact:true}).click();await page.waitForURL(/q=God/);assert.equal(await page.locator('[name="collection"]').inputValue(),"action");await page.locator('main a[href="/steam-gifts/1593500"]').waitFor();
  await page.goto(base+"/?q=no-such-topup-qa",{waitUntil:"domcontentloaded"});assert.equal(await page.getByRole("heading",{name:"Featured Steam Gifts"}).count(),0);
  assert.equal((await context.request.get(base+"/steam-gifts/570")).status(),404);assert.equal((await context.request.post(base+"/api/cron/steam-library")).status(),401);
  assert.deepEqual(errors,[]);await writeFile(path.join(output,process.env.AUDIT_CURATION_SMOKE==="1"?"live-smoke.json":"report.json"),JSON.stringify({base,cases,collectionSearchAndPaging:"passed",featuredEligibility:"passed",privateCosts:"passed",freeGameRejected:"passed",workerAuth:"passed",errors,paidOrdersCreated:0},null,2));console.log(`PASS: ${cases.length} responsive/theme route cases, verified featured games, collection/search/paging, private costs, free-game rejection and worker authentication; no paid orders.`);
}finally{await browser.close();}
