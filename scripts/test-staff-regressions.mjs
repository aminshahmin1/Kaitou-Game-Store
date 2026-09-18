import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const rows = [];
let cookie;
const env = { ADMIN_SESSION_SECRET: "isolated-staff-test-session-secret", ADMIN_EMAIL: "owner@example.test" };
const database = {
  from(table) {
    assert.equal(table, "staff_accounts");
    let operation = "read", values, fields = "*";
    const filters = [];
    const execute = () => {
      let matches = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      if (operation === "insert") {
        if (rows.some((row) => row.email === values.email)) return { data: null, error: { code: "23505" } };
        const row = { id: `test-${rows.length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_login_at: null, ...values };
        rows.push(row);
        matches = [row];
      } else if (operation === "update") {
        matches.forEach((row) => Object.assign(row, values));
      }
      return { data: matches.map((row) => fields === "*" ? { ...row } : Object.fromEntries(fields.split(",").map((field) => [field.trim(), row[field.trim()]]))), error: null };
    };
    const query = {
      select(value) { fields = value; return query; },
      order() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      insert(value) { operation = "insert"; values = value; return query; },
      update(value) { operation = "update"; values = value; return query; },
      async single() { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      async maybeSingle() { return query.single(); },
      then(resolve) { return Promise.resolve(execute()).then(resolve); },
    };
    return query;
  },
};
class TestResponse extends Response {
  cookies = { set: ({ value }) => { cookie = value; } };
  static json(body, options) { return new TestResponse(JSON.stringify(body), options); }
}
const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const { outputText } = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  vm.runInNewContext(outputText, {
    exports, Buffer, Date, console, process: { env },
    require(name) {
      if (name === "server-only") return {};
      if (name === "next/server") return { NextResponse: TestResponse };
      if (name === "next/headers") return { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) };
      if (name.endsWith("supabase/admin")) return { createSupabaseAdminClient: () => database };
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), `${name}.ts`));
      return require(name);
    },
  }, { filename: absolute });
  return exports;
}
const sessions = load("src/lib/auth/admin-session.ts");
const api = load("src/lib/auth/admin-api.ts");
const staff = load("src/lib/staff.ts");
const createRoute = load("src/app/api/admin/staff/route.ts");
const editRoute = load("src/app/api/admin/staff/[id]/route.ts");
const loginRoute = load("src/app/api/admin/login/route.ts");
const request = (payload) => ({ json: async () => payload });
const ownerCookie = sessions.createAdminSession({ email: "owner@example.test", role: "owner", permissions: [] });
assert.equal((await createRoute.GET()).status, 401);
cookie = ownerCookie;
const password = "test-only-password-123";
const payload = { email: "support@example.test", password, role: "support", permissions: ["review"] };
assert.equal((await createRoute.POST(request({ ...payload, email: "OWNER@example.test" }))).status, 400);
assert.equal((await createRoute.POST(request({ ...payload, password: "short" }))).status, 400);
assert.equal((await createRoute.POST(request({ ...payload, permissions: [] }))).status, 400);
const created = await createRoute.POST(request(payload));
assert.equal(created.status, 201);
const { staffId } = await created.json();
assert.notEqual(rows[0].password_hash, password);
rows.push({ ...rows[0], id: "legacy-owner-duplicate", email: env.ADMIN_EMAIL });
assert.equal(await sessions.verifyDashboardCredentials(env.ADMIN_EMAIL, password), null);
assert.ok(!(await staff.getStaffAccounts())[0].password_hash);
assert.equal((await createRoute.POST(request(payload))).status, 400);
assert.equal((await loginRoute.POST(request({ email: payload.email, password: "wrong" }))).status, 401);
assert.equal((await loginRoute.POST(request(payload))).status, 200);
const staffCookie = cookie;
assert.ok(await api.getAdminApiSession("review"));
for (const permission of ["products", "revenue", "staff", "integrations", "settings"]) {
  assert.equal(await api.getAdminApiSession(permission), null);
}
assert.equal((await createRoute.POST(request(payload))).status, 401);
assert.equal((await editRoute.PATCH(request({ permissions: ["staff"] }), { params: Promise.resolve({ id: staffId }) })).status, 401);
cookie = ownerCookie;
assert.equal((await editRoute.PATCH(request({ password: "", permissions: ["revenue"] }), { params: Promise.resolve({ id: staffId }) })).status, 200);
cookie = staffCookie;
assert.equal(await api.getAdminApiSession("review"), null);
assert.ok(await api.getAdminApiSession("revenue"));
cookie = ownerCookie;
assert.equal((await editRoute.PATCH(request({ active: false }), { params: Promise.resolve({ id: staffId }) })).status, 200);
cookie = staffCookie;
assert.equal(await api.getAdminApiSession("revenue"), null);
assert.equal((await loginRoute.POST(request(payload))).status, 401);
cookie = `${ownerCookie}tampered`;
assert.equal(await api.getAdminApiSession("staff"), null);
console.log("PASS: staff validation, creation, hashing, login, permissions, forbidden edits, live permission changes, disabling, and tampered sessions (isolated database).");
