import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(relativePath, dependencies = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, process, Date, Intl, Buffer, URL, Response,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const dates = load("../src/lib/revenue-dates.ts");
for (const timezone of ["UTC", "Asia/Kuala_Lumpur", "America/Los_Angeles"]) {
  process.env.TZ = timezone;
  assert.equal(dates.malaysiaDate(new Date("2026-09-18T15:59:59Z")), "2026-09-18");
  assert.equal(dates.malaysiaDate(new Date("2026-09-18T16:00:00Z")), "2026-09-19");
  assert.equal(dates.revenueQuickRange("today", new Date("2026-09-18T22:00:00Z")).from, "2026-09-19");
  assert.equal(dates.revenueQuickRange("week", new Date("2026-09-20T16:00:00Z")).from, "2026-09-21");
  assert.equal(dates.revenueQuickRange("month", new Date("2026-09-30T16:00:00Z")).from, "2026-10-01");
  assert.equal(dates.revenueQuickRange("week", new Date("2026-01-01T00:00:00Z")).from, "2025-12-29");
}

const paidTimes = ["2026-09-18T15:59:59.999Z", "2026-09-18T16:00:00Z", "2026-09-19T15:59:59.999Z", "2026-09-19T16:00:00Z"];
const orders = paidTimes.map((paid_at, index) => ({
  id: String(index), order_number: `QA-${index}`, paid_at, created_at: paid_at,
  status: "completed", amount_myr: 10, cost_usd: 1, cost_myr: 4,
  payment_fee_myr: 1, gross_profit_myr: 6, net_profit_myr: 5,
  profit_allocated_at: paid_at,
}));
const revenue = load("../src/lib/revenue.ts", {
  "server-only": {},
  "./revenue-dates": dates,
  "./supabase/admin": {
    createSupabaseAdminClient: () => ({
      from: (table) => {
        const query = {
          select: () => query, in: () => query, order: () => query,
          then: (resolve) => Promise.resolve({ data: table === "orders" ? orders : [], error: null }).then(resolve),
        };
        return query;
      },
    }),
  },
});
const report = await revenue.getRevenueDashboard({ from: "2026-09-19", to: "2026-09-19" });
assert.equal(report.summary.paidOrders, 2);
assert.equal(report.summary.revenueMyr, 20);
assert.equal(report.recentOrders.map((row) => row.orderNumber).join(","), "QA-1,QA-2");
const route = load("../src/app/api/admin/revenue/export/route.ts", {
  "next/server": { NextResponse: Response },
  "@/lib/auth/admin-api": { getAdminApiSession: async () => ({ role: "owner" }) },
  "@/lib/revenue": revenue,
});
const response = await route.GET({ url: "https://kaitou.shop/api/admin/revenue/export?from=2026-09-19&to=2026-09-19" });
const csv = await response.text();
assert.ok(csv.includes("Revenue MYR,20"));
assert.ok(csv.includes("QA-1,") && csv.includes("QA-2,"));
assert.ok(!csv.includes("QA-0,") && !csv.includes("QA-3,"));
console.log("PASS: Malaysia date boundaries, weekly/monthly presets, report rows, and CSV date filtering.");
