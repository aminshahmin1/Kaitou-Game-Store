import { createRequire } from "node:module";
import path from "node:path";
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.TEMP,"kaitou-audit-tools/node_modules/playwright"));
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const url=`${process.env.AUDIT_BASE_URL}/steam-gifts/367580`;
  const server=await browser.newContext({javaScriptEnabled:false}),client=await browser.newContext();
  const ssr=await server.newPage(),hydrated=await client.newPage(),errors=[];
  hydrated.on("pageerror",error=>errors.push(error.message));
  await ssr.goto(url,{waitUntil:"load",timeout:90000});
  const before=await ssr.locator('select[name="variationId"] option').allTextContents();
  await hydrated.goto(url,{waitUntil:"domcontentloaded",timeout:90000});
  await hydrated.waitForFunction(()=>Boolean(document.documentElement.dataset.theme));
  await hydrated.waitForTimeout(1000);
  const after=await hydrated.locator('select[name="variationId"] option').allTextContents();
  console.log(JSON.stringify({errors,differences:before.flatMap((label,index)=>label===after[index]?[]:[{server:label,browser:after[index]}])},null,2));
}finally{await browser.close();}
