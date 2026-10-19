import { createRequire } from "node:module";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const base=process.env.AUDIT_BASE_URL??"http://localhost:3100",output=path.resolve("artifacts/library-release");
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext();
await context.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));
const page=await context.newPage(),errors=[],cases=[];
page.on("pageerror",error=>{errors.push(error.message);console.error("Browser error:",new URL(page.url()).pathname,error.message);});page.setDefaultNavigationTimeout(90000);
try{
  await page.goto(base,{waitUntil:"domcontentloaded"});
  if(process.env.AUDIT_INTERACTIONS_ONLY!=="1") for(const width of [390,1024,1440])for(const theme of ["light","dark"])for(const route of ["/about","/faq","/support","/steam-gifts","/steam-gifts?q=Palworld","/steam-gifts/1623730"]){
    await page.setViewportSize({width,height:960});
    await page.evaluate(theme=>localStorage.setItem("kaitou-theme",theme),theme);
    const response=await page.goto(`${base}${route}`,{waitUntil:"domcontentloaded"});assert.equal(response.status(),200,route);
    await page.getByRole("main").waitFor();await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
    const result=await page.evaluate(async()=>{const imgs=[...document.querySelectorAll("main img")];for(const img of imgs)img.loading="eager";await Promise.all(imgs.map(img=>img.decode().catch(()=>{})));return{overflow:document.documentElement.scrollWidth>innerWidth+2,images:imgs.map(img=>({loaded:img.naturalWidth>0,width:img.clientWidth,natural:img.naturalWidth}))};});
    assert.equal(result.overflow,false,`${route} ${width}px overflow`);assert.ok(result.images.every(img=>img.loaded),`${route} unloaded image`);
    const html=await page.content();for(const privateField of ["costUsd","cost_usd","fazercardsSku","FAZERCARDS_API_KEY"])assert.ok(!html.includes(privateField),`${route}: private field leaked`);
    assert.ok(!html.includes(["017","263","7043"].join("")));
    cases.push({route,width,theme,...result});await page.screenshot({path:path.join(output,`${route.replace(/\W+/g,"-")}-${width}-${theme}.png`),fullPage:true});console.log(`PASS: ${route} ${width}px ${theme}`);
  }
  await page.goto(`${base}/faq`,{waitUntil:"domcontentloaded"});await page.getByRole("main").waitFor();
  const summary=page.locator("summary").first();await summary.click();assert.equal(await summary.evaluate(el=>el.parentElement.open),true);await summary.click();
  await page.setViewportSize({width:1440,height:960});await summary.hover();await page.waitForTimeout(200);
  const hover=await summary.evaluate(el=>getComputedStyle(el).scale);assert.ok(Number(hover)>1);
  await page.mouse.down();await page.waitForTimeout(150);assert.ok(Number(await summary.evaluate(el=>getComputedStyle(el).scale))<1);await page.mouse.up();
  await page.emulateMedia({reducedMotion:"reduce"});await summary.hover();assert.ok(["none","1"].includes(await summary.evaluate(el=>getComputedStyle(el).scale)));await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto(`${base}/steam-gifts/367580`,{waitUntil:"domcontentloaded"});
  const form=page.locator("form").filter({has:page.locator('input[name="steam_invite_url"]')});
  await form.waitFor();
  const availableOption=await form.locator('[name="variationId"]').evaluate(select=>[...select.options].find(option=>option.value&&!option.textContent.includes("Out of stock"))?.value);
  assert.ok(availableOption,"No affordable region available for the intercepted UI test");
  await form.locator('[name="variationId"]').selectOption(availableOption);
  await form.locator('[name="customerName"]').fill("Browser verification");await form.locator('[name="customerEmail"]').fill("qa@example.invalid");await form.locator('[name="whatsapp"]').fill("0123456789");await form.locator('[name="steam_invite_url"]').fill("https://s.team/p/qa-test/abcde");
  const help=page.getByRole("button",{name:"Where to find your Steam invite link"});await help.click();await page.getByText("Get your Steam friend invite link").waitFor();await help.click();await page.mouse.move(0,0);
  await form.getByRole("button",{name:/Review .* order/}).click();const dialog=page.getByRole("dialog",{name:"Review your Steam gift"});await dialog.waitFor();await page.screenshot({path:path.join(output,"steam-confirmation.png"),fullPage:true});await dialog.getByRole("button",{name:"Go back"}).click();assert.equal(await form.locator('[name="customerName"]').inputValue(),"Browser verification");
  let intercepted=0;await page.route("**/api/checkout",async route=>{intercepted++;const payload=route.request().postDataJSON();assert.ok(payload.expectedPriceMyr>0);assert.equal(payload.fieldValues.steam_invite_url,"https://s.team/p/qa-test/abcde");await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Simulated connection error; no order created."})});});
  await form.getByRole("button",{name:/Review .* order/}).click();await dialog.getByRole("button",{name:"Continue to FPX"}).click();await page.getByRole("alert").filter({hasText:"Simulated"}).waitFor();assert.equal(intercepted,1);assert.equal(await form.locator('[name="steam_invite_url"]').inputValue(),"https://s.team/p/qa-test/abcde");
  assert.equal((await context.request.post(`${base}/api/cron/steam-library`)).status(),401);assert.deepEqual(errors,[]);
  await writeFile(path.join(output,process.env.AUDIT_INTERACTIONS_ONLY==="1"?"interactions.json":"report.json"),JSON.stringify({base,cases,errors,hoverPressReducedMotion:"passed",steamConfirmationAndFailedRetry:"passed",paidOrdersCreated:0},null,2));
  console.log("PASS: FAQ, desktop hover/press, reduced motion, Steam region/edition checkout, invite guide, confirmation, retained fields and mocked retry; zero paid orders.");
}finally{await browser.close();}
