import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, "kaitou-audit-tools/node_modules/playwright"));
const base = process.env.AUDIT_BASE_URL ?? "https://kaitou.shop";
const label = process.env.AUDIT_LABEL ?? "production";
const output = path.resolve("artifacts", `audit-2026-10-19-${label}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = process.env.AUDIT_INTERACTIONS_ONLY === "1"
  ? JSON.parse(await readFile(path.join(output, "report.json"), "utf8"))
  : { base, cases: [], errors: [], api: [], interactions: [] };
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push({ path: new URL(page.url()).pathname, message: error.message }));
page.on("dialog", async (dialog) => dialog.dismiss());
const paths = ["/", "/about", "/order-status", "/leaderboard", "/products/mobile-legends-malaysia",
  "/products/pubg-mobile-auto-pubg-mobile-auto", "/products/free-fire-my-sg-free-fire-my-sg", "/products/wuthering-waves-wuthering-waves"];
async function inspect(route, width, theme, admin = false) {
  await page.setViewportSize({ width, height: 960 });
  await page.addInitScript((theme) => localStorage.setItem("kaitou-theme", theme), theme);
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('[data-product-poster] img')];
    images.forEach((image) => { image.loading = "eager"; });
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  });
  const metrics = await page.evaluate(() => {
    const visible = (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const overflow = [...document.querySelectorAll("main *")].filter((el) => {
      if (!visible(el) || ["OPTION", "SVG", "PATH"].includes(el.tagName)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.right <= innerWidth + 2 && rect.left >= -2) return false;
      let parent = el.parentElement;
      while (parent) { if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(parent).overflowX)) return false; parent = parent.parentElement; }
      return true;
    }).map((el) => ({ tag: el.tagName, text: el.textContent?.trim().slice(0, 55) })).slice(0, 12);
    const controls = [...document.querySelectorAll('form button[type="submit"], form strong, form [data-dark-surface], main [data-dark-surface] strong')]
      .filter(visible).map((el) => { let parent = el, background = ""; while (parent) {
        background = getComputedStyle(parent).backgroundColor;
        if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break;
        parent = parent.parentElement;
      } return { text: el.textContent?.trim().slice(0, 80), color: getComputedStyle(el).color, background }; });
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 2, overflow,
      posters: [...document.querySelectorAll('[data-product-poster] img')].map((img) => ({ loaded: img.complete && img.naturalWidth > 0, fallback: img.currentSrc.includes("logo-current"), width: img.naturalWidth })), controls,
      h1: document.querySelector("h1")?.textContent,
      exposedCosts: /costUsd|cost_usd|fazercardsSku|cost_exchange_rate/.test(document.documentElement.innerHTML) };
  });
  const name = `${admin ? "admin-" : ""}${route.replace(/\W+/g, "-") || "home"}-${width}-${theme}`;
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  report.cases.push({ route, width, theme, status: response.status(), ...metrics });
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(`Checked ${route} ${width}px ${theme}: HTTP${response.status()}, overflow=${metrics.pageOverflow}, posters=${metrics.posters.filter((x) => x.loaded && !x.fallback).length}`);
}
if (process.env.AUDIT_INTERACTIONS_ONLY !== "1") {
  for (const width of [390, 1440]) for (const theme of ["light", "dark"]) for (const route of paths) await inspect(route, width, theme);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Open menu", exact: true }).click();
report.interactions.push({ name: "Mobile menu", passed: await page.getByRole("link", { name: "Rankings", exact: true }).last().isVisible() });
await page.getByRole("button", { name: "Search products", exact: true }).click();
await page.getByLabel("Search games and top-ups", { exact: true }).fill("Mobile Legends");
await page.locator("header").getByRole("button", { name: "Search", exact: true }).click();
await page.waitForURL(/q=Mobile/);
report.interactions.push({ name: "Product search", passed: (await page.locator('main a[href^="/products/"]').count()) === 1 });
await page.goto(`${base}/products/mobile-legends-malaysia`, { waitUntil: "networkidle" });
if (await page.locator('form input[name="customerName"]').count()) {
  await page.locator('input[name="customerName"]').fill("Development Audit");
  await page.locator('input[name="customerEmail"]').fill("audit@example.invalid");
  await page.locator('input[name="whatsapp"]').fill("0100000000");
  for (const input of await page.locator('form input[inputmode="numeric"]').all()) await input.fill("123456");
  await page.route("**/api/checkout", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Simulated connection failure" }) }));
  await page.locator('form button[type="submit"]').click();
  await page.locator('form [role="alert"]').waitFor();
  report.interactions.push({ name: "Checkout error recovery (mock only)", passed: await page.locator('form button[type="submit"]').isEnabled() });
  report.interactions.push({ name: "Checkout preserves customer details after failure", passed: await page.locator('input[name="customerName"]').inputValue() === "Development Audit" });
  await page.unroute("**/api/checkout");
  await page.route("**/api/checkout", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    orderId: "DEVELOPMENT-SIMULATED", paymentUrl: "https://toyyibpay.com/DEVELOPMENT-NOT-A-REAL-BILL", paymentSetupRequired: false,
  }) }));
  await page.locator('form button[type="submit"]').click();
  const payment = page.getByRole("link", { name: "Continue payment", exact: true });
  await payment.waitFor();
  report.interactions.push({ name: "Payment continuation state (mock only)", passed: await payment.isVisible(),
    color: await payment.evaluate((el) => getComputedStyle(el).color) });
  await page.screenshot({ path: path.join(output, "simulated-payment-link.png"), fullPage: true });
  await page.unroute("**/api/checkout");
}
for (const route of ["/api/admin/products", "/api/admin/orders", "/api/admin/staff", "/api/admin/revenue", "/api/admin/fazercards/balance"]) {
  const result = await context.request.get(`${base}${route}`); report.api.push({ route, status: result.status(), expected: 401 });
}
for (const route of ["balance", "bundles", "payments", "fulfillment", "order-emails"]) {
  const result = await context.request.post(`${base}/api/cron/${route}`); report.api.push({ route: `/api/cron/${route}`, status: result.status(), expected: 401 });
}
// Admin visual inspection uses the owner's already logged-in browser, not synthetic sessions.
await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ output, cases: report.cases.length, errors: report.errors, interactions: report.interactions,
  overflows: report.cases.filter((c) => c.pageOverflow), badApi: report.api.filter((c) => c.status !== c.expected) }, null, 2));
