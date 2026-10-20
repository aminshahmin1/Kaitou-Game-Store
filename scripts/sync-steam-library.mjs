import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Operator CLI for the same server-side catalogue functions; never creates orders.
const require = createRequire(import.meta.url), modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {}; modules.set(file,exports);
  const source = ts.transpileModule(readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, process, fetch, Buffer, URL, URLSearchParams, AbortSignal, AbortController, console, setTimeout, clearTimeout, require(name) {
    if (name === "server-only") return {};
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file),`${name}.ts`));
    if (name.startsWith("@/")) return load(path.resolve("src",`${name.slice(2)}.ts`));
    return require(name);
  } }, { filename: file });
  return exports;
}
try {
  const research = process.argv.includes("--research") || process.argv.includes("--research-report");
  if (research) process.loadEnvFile(".env.local");
  const library = load(path.resolve("src/lib/steam-library.ts"));
  if (research) {
    if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "neyezqvhkxahfqidhnsn.supabase.co") throw Error("Wrong research project.");
    const db = load(path.resolve("src/lib/supabase/admin.ts")).createSupabaseAdminClient();
    if (process.argv.includes("--research-report")) {
      const audit=JSON.parse(readFileSync("docs/steam-research-source-2026-10-20.json","utf8"));
      const {data,error}=await db.from("steam_library_games").select("appid,name,supplier_active,metadata_status,metadata_checked_at").not("curated_rank","is",null);
      if(error)throw Error("Research report unavailable.");
      const byId=new Map(data.map(row=>[Number(row.appid),row]));
      const rows=audit.rows.map(row=>({title:row.title,appid:row.appid,collection:row.collection,resolution:row.resolution,verification:row.appid?(byId.get(row.appid)?.supplier_active?byId.get(row.appid).metadata_status:"unavailable"):"held",checkedAt:byId.get(row.appid)?.metadata_checked_at??null}));
      const summary=rows.reduce((counts,row)=>(counts[row.verification]=(counts[row.verification]??0)+1,counts),{});
      await mkdir("artifacts/steam-curation",{recursive:true});
      await writeFile("artifacts/steam-curation/catalogue-audit.json",JSON.stringify({generatedAt:new Date().toISOString(),summary,rows},null,2));
      console.log(JSON.stringify({summary,report:"artifacts/steam-curation/catalogue-audit.json"}));
    } else {
    const { data, error } = await db.from("steam_library_games").select("appid,name").eq("supplier_active",true).eq("metadata_status","pending")
      .not("curated_rank","is",null).or(`metadata_attempt_at.is.null,metadata_attempt_at.lt.${new Date(Date.now()-3600000).toISOString()}`)
      .order("curated_rank").limit(45);
    if (error) throw Error("Research queue unavailable.");
    let cursor=0,verified=0,excluded=0,failed=0,busy=false;
    async function worker(){while(cursor<(data?.length??0)&&!busy){const row=data[cursor++];try{if(await library.verifySteamGame(row.appid)){verified++;console.log(`Verified: ${row.name}`);}else{excluded++;console.log(`Excluded: ${row.name}`);}}catch(error){failed++;if(String(error).includes("checks are busy"))busy=true;console.log(`Pending: ${row.name}`);}}}
    await Promise.all([worker(),worker(),worker()]);
    console.log(JSON.stringify({checked:cursor,verified,excluded,failed,busy,paidOrdersCreated:0}));
    }
  } else console.log(JSON.stringify({ catalog: await library.syncSteamCatalogue((stage)=>console.log(stage),300000), metadata: await library.verifyPendingSteamGames(4) }));
} catch (error) { console.error("Steam library sync failed:", String(error), error?.cause ?? ""); process.exitCode = 1; }
