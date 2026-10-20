import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file,deps={},globals={}) {
  const exports={}; vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,URL,URLSearchParams,AbortSignal,process:{env:{FAZERCARDS_API_KEY:"fixture"}},...globals,require(name){if(name==="server-only")return {};return name in deps?deps[name]:require(name);}});return exports;
}
const pricing=load("src/lib/steam-pricing.ts");
for (const [cost,markup] of [[0.01,1],[10,1],[10.01,2],[20,2],[20.01,3],[50,3],[50.01,4],[80,4],[80.01,5],[100,5],[100.01,6],[150,6],[150.01,7],[200,7],[200.01,8],[250,8],[250.01,9],[300,9],[300.01,10],[1000,10]]) {
  const result=pricing.steamSellingPrice(cost,1);assert.equal(result.markupMyr,markup);assert.equal(result.priceMyr,Math.round((cost+markup)*100)/100);
}
assert.equal(pricing.steamSellingPrice(1,4.08).priceMyr,5.08);
for(const cost of [0,-1,NaN,Infinity])assert.throws(()=>pricing.steamSellingPrice(cost,4.08));
assert.equal(pricing.normalizeSteamInvite("s.team/p/abc-def/ghijk/"),"https://s.team/p/abc-def/ghijk");
for(const url of ["http://s.team/p/a/b","https://s.team.evil.test/p/a/b","https://evil.test/p/a/b","https://user@s.team/p/a/b","https://s.team/p/a/b?next=x","https://s.team/p/a/b#x","https://s.team:444/p/a/b","https://s.team/p/../bad","javascript:alert(1)"])assert.throws(()=>pricing.normalizeSteamInvite(url));
let metadataType="game",free=false,comingSoon=false,wrongId=false,budget=true,fetches=0,productActive=true;
const calls=[], games=new Map([[42,{appid:42,name:"Test base game",supplier_active:true,metadata_status:"pending",metadata_checked_at:null}]]);
function database(){return {from(table){const filters={};let patch,upsert;
  const query={select(){return query;},eq(k,v){filters[k]=v;return query;},update(v){patch=v;return query;},upsert(v,o){upsert=v;calls.push({table,upsert:v,options:o});return query;},
    async maybeSingle(){if(table==="steam_library_games")return{data:games.get(filters.appid)??null};if(table==="steam_library_packages")return{data:{appids:filters.subid===300?[99]:[42],checked_at:new Date().toISOString()}};throw Error(table);},
    async single(){return{data:table==="steam_library_sync"?{pending_count:0}:{id:"product",source:"steam_library",active:productActive,available:true}};},
    then(resolve){if(patch&&table==="steam_library_games")Object.assign(games.get(filters.appid),patch);let data=null;
      if(table==="product_variations"&&!upsert)data=[{id:"a",sku:"steam-42-100:MY",active:true,available:true},{id:"b",sku:"steam-42-200:MY",active:false,available:false}];
      return Promise.resolve({data,error:null}).then(resolve);}};return query;},
  rpc(name,args){calls.push({rpc:name,args});const result=name==="consume_request_limit"?{data:[{allowed:budget}]}:{data:null,error:null};const promise=Promise.resolve(result);promise.abortSignal=()=>promise;return promise;}};}
const stock=load("src/lib/stock.ts");
const library=load("src/lib/steam-library.ts",{
  "./steam-collections":load("src/lib/steam-collections.ts"),
  "./supabase/admin":{createSupabaseAdminClient:database},"./funding-cost":{getFundingCostBasis:async()=>({rate:4.08})},"./supplier-credit":{getAvailableSupplierCredit:async()=>100},"./stock":stock,"./steam-pricing":pricing,
  "./integrations/fazercards-catalog":{getFazerCardsCatalogDetails:async()=>({categoryId:"42",offers:[{offerId:"100:MY",edition:"Standard",region:"MY",name:"Standard (MY)",priceUsd:1},{offerId:"200:MY",edition:"Deluxe",region:"MY",name:"Deluxe (MY)",priceUsd:2},{offerId:"300:MY",edition:"DLC only",region:"MY",name:"DLC only",priceUsd:1},{offerId:"400:MY",name:"Free",priceUsd:0}]})},
},{fetch:async()=>{fetches++;return{ok:true,json:async()=>({"42":{success:true,data:{type:metadataType,name:"Game",steam_appid:wrongId?99:42,is_free:free,release_date:{coming_soon:comingSoon},header_image:"https://cdn.cloudflare.steamstatic.com/steam/apps/42/header.jpg"}}})};}});
assert.equal((await library.syncSteamCatalogue()).skipped,true);
assert.equal(fetches,0);
assert.equal((await library.verifySteamGame(42)).appid,42);assert.equal(fetches,1);
await library.verifySteamGame(42);assert.equal(fetches,1,"Fresh metadata must be cached");
for(const [type,isFree]of[["dlc",false],["demo",false],["game",true]]){Object.assign(games.get(42),{metadata_checked_at:null,metadata_status:"pending"});metadataType=type;free=isFree;assert.equal(await library.verifySteamGame(42),null);}
metadataType="game";free=false;Object.assign(games.get(42),{metadata_checked_at:null,metadata_status:"pending"});wrongId=true;await assert.rejects(library.verifySteamGame(42),/identity/);wrongId=false;
comingSoon=true;assert.equal(await library.verifySteamGame(42),null,"Unreleased candidates must not be published");comingSoon=false;Object.assign(games.get(42),{metadata_checked_at:null,metadata_status:"pending"});
budget=false;const previous=fetches;await assert.rejects(library.verifySteamGame(42),/busy/);assert.equal(fetches,previous);budget=true;
await library.verifySteamGame(42);
const product=await library.prepareSteamProduct(42);
assert.equal(product.variations.length,2,"DLC-only and zero-price packages must be excluded");
assert.equal(product.variations[0].priceMyr,5.08);assert.equal(product.variations[1].available,false,"Manual disable must survive sync");
assert.equal(product.variations[0].edition,"Standard");assert.equal(product.variations[0].region,"MY");
const refresh=calls.find((call)=>call.rpc==="price_steam_library_variations");assert.equal(refresh.args.p_rate,4.08);
assert.equal(calls.find((call)=>call.table==="products").options.ignoreDuplicates,true);
productActive=false;assert.equal((await library.prepareSteamProduct(42)).available,false);
const projection=load("src/lib/checkout-product.ts").toCheckoutProduct(product);
assert.equal(projection.steamGift,true);assert.ok(!JSON.stringify(projection).includes("costUsd"));assert.ok(!JSON.stringify(projection).includes("fazercardsSku"));
console.log("PASS: Continuous Steam tiers, MYR conversion, invite allowlist, free/DLC/type checks, metadata cache/quota, base-game edition validation, manual disabling and private buyer projection.");
