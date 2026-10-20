import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const base=process.env.AUDIT_BASE_URL??"http://localhost:3100",output=path.resolve("artifacts/direct-support");
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext();
await context.addInitScript(()=>sessionStorage.setItem("kaitou-ranking-promo-v1","seen"));
const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));page.setDefaultNavigationTimeout(90000);
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
const receipt={name:"support-test.png",mimeType:"image/png",buffer:png};
try {
  for(const status of ["processing","completed"]){
    await page.goto(base+"/order-status",{waitUntil:"domcontentloaded"});
    await page.route("**/api/order-status",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({order:{orderNumber:"KGS-QA-NOT-AN-ORDER",status,productTitle:"Support verification",variationTitle:"No real purchase",amountMyr:1,updatedAt:new Date().toISOString(),failureReason:null}})}));
    await page.locator('[name="orderNumber"]').fill("KGS-QA-NOT-AN-ORDER");await page.locator('[name="contact"]').fill("qa@example.invalid");await page.getByRole("button",{name:"Check",exact:true}).click();await page.getByRole("heading",{name:"KGS-QA-NOT-AN-ORDER"}).waitFor();
    const help=page.getByRole("link",{name:"Get help",exact:true});assert.equal(await help.count(),status==="completed"?0:1);
    if(status!=="completed"){await help.click();assert.equal(await page.locator('[name="order"]').inputValue(),"KGS-QA-NOT-AN-ORDER");}
    await page.unroute("**/api/order-status");
  }
  for(const width of [390,1440])for(const theme of ["light","dark"]){
    await page.setViewportSize({width,height:960});await page.goto(base+"/support?order=KGS-QA-NOT-AN-ORDER",{waitUntil:"domcontentloaded"});
    await page.evaluate(t=>localStorage.setItem("kaitou-theme",t),theme);await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"Send message",exact:true}).waitFor();
    assert.equal(await page.locator('[name="order"]').inputValue(),"KGS-QA-NOT-AN-ORDER");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.screenshot({path:path.join(output,`support-${width}-${theme}.png`),fullPage:true});
  }
  const form=page.locator("form");
  await form.locator('[name="name"]').fill("Kaitou support verification");
  await form.locator('[name="email"]').fill("amin@kaitou.shop");
  await form.locator('[name="phone"]').fill("0123456789");
  await form.locator('[name="message"]').fill("Website support delivery test only. No real order, payment or customer issue. Please ignore this test message.");
  await page.locator('#support-files').setInputFiles({name:"blocked.exe",mimeType:"application/octet-stream",buffer:Buffer.from("test")});await page.getByRole("alert").filter({hasText:"Only JPG"}).waitFor();
  await page.locator('#support-files').setInputFiles(receipt);await page.getByRole("button",{name:"Remove support-test.png"}).click();assert.equal(await page.getByRole("button",{name:"Remove support-test.png"}).count(),0);
  await page.locator('#support-files').setInputFiles(receipt);
  let count=0;await page.route("**/api/support",async route=>{count++;await new Promise(resolve=>setTimeout(resolve,400));assert.match(route.request().headers()["content-type"],/multipart\/form-data/);await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Simulated sending failure"})});});
  await form.getByRole("button",{name:"Send message",exact:true}).click();await page.getByRole("alert").filter({hasText:"Simulated"}).waitFor();assert.equal(count,1);
  assert.equal(await form.locator('[name="name"]').inputValue(),"Kaitou support verification");await page.getByRole("button",{name:"Remove support-test.png"}).waitFor();
  await page.unroute("**/api/support");
  if(process.env.SUPPORT_LIVE_SEND!=="1")await page.route("**/api/support",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({reference:"SUP-QATEST00"})}));
  await form.getByRole("button",{name:"Send message",exact:true}).click();await page.getByRole("status").filter({hasText:"Your message has been sent"}).waitFor({timeout:60000});
  assert.equal(await form.locator('[name="name"]').inputValue(),"");assert.equal(await page.getByRole("button",{name:"Remove support-test.png"}).count(),0);
  const confirmation=await page.getByRole("status").filter({hasText:"Your message has been sent"}).textContent();
  await page.screenshot({path:path.join(output,"support-sent.png"),fullPage:true});assert.deepEqual(errors,[]);
  await writeFile(path.join(output,"report.json"),JSON.stringify({base,errors,confirmation,responsiveThemeCases:4,attachmentValidationAndRemoval:"passed",failureRetention:"passed",realSupportEmailsSent:process.env.SUPPORT_LIVE_SEND==="1"?1:0},null,2));
  console.log("PASS: responsive/themes, prefilled order, attachment validation/removal, failed-send retention and success reset.",confirmation);
} finally {await browser.close();}
