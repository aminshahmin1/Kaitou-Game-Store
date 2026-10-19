import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, "kaitou-audit-tools/node_modules/playwright"));
const base = process.env.AUDIT_BASE_URL ?? "http://localhost:3100";
const output = path.resolve("artifacts", "support-release");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultNavigationTimeout(90000);
const navigate = (url) => page.goto(url, { waitUntil: "domcontentloaded" });
const errors = [], findings = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(base);
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: path.join(output, "ranking-promotion-mobile.png"), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  await navigate(base);
  assert.equal(await page.getByRole("dialog").isVisible(), false);
  const routes = ["/", "/about", "/leaderboard", "/order-status", "/products/mobile-legends-malaysia",
    "/products/pubg-mobile-auto-pubg-mobile-auto", "/products/free-fire-my-sg-free-fire-my-sg", "/products/wuthering-waves-wuthering-waves"];
  for (const width of [390, 1440]) for (const theme of ["light", "dark"]) for (const route of routes) {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript((theme) => localStorage.setItem("kaitou-theme", theme), theme);
    const response = await navigate(`${base}${route}`);
    await page.getByRole("main").waitFor();
    assert.equal(response.status(), 200, `${route} unavailable`);
    const content = await page.content();
    assert.ok(!content.includes(["017", "263", "7043"].join("")), "Private phone in public page");
    const result = await page.evaluate(async () => {
      const images = [...document.querySelectorAll('[data-product-poster] img')];
      images.forEach((image) => { image.loading = "eager"; });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      return { overflow: document.documentElement.scrollWidth > innerWidth + 2,
        posters: images.map((img) => ({ width: img.clientWidth, natural: img.naturalWidth, loaded: img.naturalWidth > 0 })),
        checkout: [...document.querySelectorAll('form button[type="submit"], form strong')].map((el) => ({ text: el.textContent, color: getComputedStyle(el).color })) };
    });
    assert.equal(result.overflow, false, `${route} overflow`);
    assert.ok(result.posters.every((img) => img.loaded && img.natural >= img.width), "Artwork enlarged beyond original size");
    if (route.includes("mobile-legends")) assert.ok(result.checkout.every((el) => el.color === "rgb(255, 255, 255)"));
    findings.push({ route, width, theme, ...result });
    await page.screenshot({ path: path.join(output, `${route.replace(/\W+/g, "-") || "home"}-${width}-${theme}.png`), fullPage: true });
    console.log(`PASS: ${route} ${width}px ${theme}`);
  }
  await navigate(`${base}/leaderboard`);
  for (const game of ["Mobile Legends", "PUBG", "Wuthering", "Free Fire"]) {
    assert.ok(await page.getByRole("link", { name: new RegExp(game) }).count(), `Missing ${game} board`);
  }
  await page.getByRole("link", { name: /PUBG/ }).click();
  await page.getByText("Be the first to claim a place on this leaderboard.").waitFor();
  for (const status of ["processing", "review", "failed", "refunded", "completed"]) {
    await navigate(`${base}/order-status`);
    await page.route("**/api/order-status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ order: {
      orderNumber: "DEVELOPMENT-ONLY", status, productTitle: "Top-up", variationTitle: "Currency", amountMyr: 10, updatedAt: new Date().toISOString(), failureReason: null,
    } }) }));
    await page.locator('input[name="orderNumber"]').fill("DEVELOPMENT-ONLY");
    await page.locator('input[name="contact"]').fill("qa@example.invalid");
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.getByRole("heading", { name: "DEVELOPMENT-ONLY" }).waitFor();
    const help = page.getByRole("link", { name: "Get help", exact: true });
    assert.equal(await help.count(), status === "completed" ? 0 : 1);
    if (status !== "completed") assert.ok((await help.getAttribute("href")).startsWith("mailto:amin@kaitou.shop?"));
    await page.unroute("**/api/order-status");
  }
  const removed = await context.request.get(`${base}/brand/facebook-cover-current.png`);
  assert.equal(removed.status(), 404, "Private-phone image remains publicly available");
  const worker = await context.request.post(`${base}/api/cron/revenue`);
  assert.equal(worker.status(), 401);
  for (const route of ["products", "orders", "revenue", "staff", "fazercards/balance"]) {
    assert.equal((await context.request.get(`${base}/api/admin/${route}`)).status(), 401);
  }
  await navigate(`${base}/leaderboard`);
  await page.getByRole("link", { name: /Mobile Legends/ }).click();
  await page.getByLabel("Rank 1", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "populated-ranking-desktop.png"), fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, "report.json"), JSON.stringify({ base, cases: findings, errors,
    promo: "passed", emptyBoards: "passed", supportStates: "passed", removedPhoneImage: "passed", workerAuth: "passed" }, null, 2));
  console.log("PASS: Promotion session/ESC, 32 theme/layout/artwork/privacy cases, empty boards, support-link status rules, private image removal and cron authentication.");
} finally { await browser.close(); }
