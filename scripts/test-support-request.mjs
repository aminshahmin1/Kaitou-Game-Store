import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, Response, Request, FormData, process, require: (name) => name === "server-only" ? {} : mocks[name] ?? require(name) });
  return exports;
}
const validation = load("../src/lib/support-request.ts");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const form = () => { const f = new FormData(); for (const [k,v] of Object.entries({ name: "Support QA", email: "qa@example.invalid", phone: "+60 123456789", order: "KGS-QA", topic: "Payment question", message: "Automated support validation only. No purchase." })) f.set(k,v); return f; };
const request = (f) => new Request("https://kaitou.shop/api/support", { method: "POST", body: f });
let data = form(); data.append("attachments", new Blob([png], { type: "image/png" }), "../receipt.png");
const parsed = await validation.validateSupportForm(await validation.readSupportForm(request(data)));
assert.equal(parsed.attachments.length, 1); assert.equal(parsed.attachments[0].filename, "attachment-1.png"); assert.equal(parsed.attachments[0].content.equals(png), true);
for (const [key,value] of [["email","bad"],["phone","abc1234567"],["name","Bad\r\nHeader"],["message","short"],["topic","Injected"]]) { data=form();data.set(key,value);await assert.rejects(validation.validateSupportForm(data)); }
for (const [type,name,body] of [["image/png","fake.png","<script>"],["image/svg+xml","bad.svg","<svg/>"],["application/pdf","bad.exe","%PDF-1.4"],["image/png","fake.png","%PDF-1.4"]]) { data=form();data.append("attachments",new Blob([body],{type}),name);await assert.rejects(validation.validateSupportForm(data)); }
data=form();for(let i=0;i<4;i++)data.append("attachments",new Blob([png],{type:"image/png"}),"receipt.png");await assert.rejects(validation.validateSupportForm(data));
data=form();data.append("attachments",new Blob([Buffer.alloc(validation.MAX_SUPPORT_FILE_BYTES+1)],{type:"application/pdf"}),"receipt.pdf");await assert.rejects(validation.validateSupportForm(data),e=>e.status===413);
await assert.rejects(validation.readSupportForm(new Request("https://kaitou.shop/api/support",{method:"POST",body:"x"})),e=>e.status===400);
await assert.rejects(validation.readSupportForm(new Request("https://kaitou.shop/api/support",{method:"POST",headers:{"content-type":"multipart/form-data; boundary=qa"},body:Buffer.alloc(validation.MAX_SUPPORT_BODY_BYTES+1)})),e=>e.status===413);
let blocked=null, sent=[], fail=false, configured=true;
const route=load("../src/app/api/support/route.ts",{
  "@/lib/support-request":validation,
  "@/lib/request-guard":{guardRequest:async(_req,scope)=>{assert.equal(scope,"support");return blocked;}},
  "@/lib/integrations/email":{getEmailConfiguration:()=>({configured,recipient:"owner@example.invalid"}),sendStoreEmail:async(...args)=>{if(fail)throw new Error("secret provider failure");sent.push(args);}},
});
data=form();data.append("attachments",new Blob([png],{type:"image/png"}),"receipt.png");
let response=await route.POST(request(data));assert.equal(response.status,200);assert.match((await response.json()).reference,/^SUP-[A-F0-9]{8}$/);
assert.equal(sent[0][0],"owner@example.invalid");assert.equal(sent[0][5].replyTo,"qa@example.invalid");assert.equal(sent[0][5].attachments.length,1);assert.match(sent[0][2],/Name: Support QA/);assert.equal(response.headers.get("cache-control"),"no-store");
data=form();data.set("website","bot");assert.equal((await route.POST(request(data))).status,400);assert.equal(sent.length,1);
configured=false;assert.equal((await route.POST(request(form()))).status,503);configured=true;
fail=true;response=await route.POST(request(form()));assert.equal(response.status,503);assert.ok(!(await response.text()).includes("secret provider"));
blocked=Response.json({error:"limit"},{status:429});assert.equal((await route.POST(request(form()))).status,429);assert.equal(sent.length,1);
console.log("PASS: support validation, bounded multipart reading, attachment signatures/limits, fixed recipient, reply-to, SMTP errors, honeypot and rate guard; no real email sent.");
