import { readFileSync } from "node:fs";
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
  const library = load(path.resolve("src/lib/steam-library.ts"));
  console.log(JSON.stringify({ catalog: await library.syncSteamCatalogue((stage)=>console.log(stage),300000), metadata: await library.verifyPendingSteamGames(4) }));
} catch (error) { console.error("Steam library sync failed:", String(error), error?.cause ?? ""); process.exitCode = 1; }
