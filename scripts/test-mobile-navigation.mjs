import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { host: "127.0.0.1", port: 5174, strictPort: false, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const names = ["The North Shore", "A World Beyond the Stars", "Midnight in Tokyo", "The Last Voyage", "Banshee", "Bocchi the Rock!", "Northern Lights", "Summer Stories", "The Observatory", "Blue Horizon", "A Quiet Place", "Wild Coast"];
const fixture = (type = "movie", prefix = "") => names.map((name, i) => ({
  id: `tt${type === "movie" ? "1" : "2"}${String(i).padStart(6, "0")}`, type, name: prefix + name, releaseInfo: `${2026 - i % 5}`,
  poster: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><defs><linearGradient id="a" x2=".7" y2="1"><stop stop-color="hsl(${i * 32},40%,35%)"/><stop offset="1" stop-color="#101014"/></linearGradient></defs><path fill="url(#a)" d="M0 0h200v300H0z"/><circle cx="145" cy="90" r="55" fill="#fff" opacity=".1"/><text x="16" y="220" fill="white" font-family="sans-serif" font-size="16">${name.split(" ").slice(0, 2).join(" ")}</text><text x="16" y="248" fill="#aaa" font-family="sans-serif" font-size="10">HARBOR QA ${i + 1}</text></svg>`)}`,
}));
const catalog = (type, id, name) => ({ type, id, name, extra: [{ name: "genre", options: ["Drama", "Comedy"] }, { name: "skip" }] });
const manifest = { id: "qa.catalog", name: "QA Cinema", version: "1.0.0", resources: ["catalog"], types: ["movie", "series"], catalogs: [catalog("movie", "top", "Popular"), catalog("movie", "slow", "Slow catalog"), catalog("movie", "error", "Unavailable"), catalog("movie", "stalled", "Stalled catalog"), catalog("series", "top", "Popular")] };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const errors = [], heavyPrefetches = [], requests = [];
  let failCatalog = true;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\/src\/views\/(player|settings)\.tsx/.test(request.url())) heavyPrefetches.push(request.url()); });
  await page.addInitScript(({ manifest, items }) => {
    localStorage.setItem("harbor.forceMobileShell", "1");
    localStorage.setItem("harbor.onboarding", JSON.stringify({ onboarded: true, nudges: {} }));
    localStorage.setItem("harbor.watchlist.v1", JSON.stringify(items.map((item, i) => ({ ...item, type: i % 2 ? "series" : "movie", addedAt: Date.now() - i * 1000 }))));
    localStorage.setItem("harbor.installed-addons", JSON.stringify([{ id: manifest.id, transportUrl: "https://qa.strem.io/manifest.json", installedAt: 1, manifest }]));
  }, { manifest, items: fixture() });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api-proxy/") && url.hostname === "127.0.0.1") return route.continue();
    if (url.protocol === "data:") return route.continue();
    if (url.pathname.includes("/catalog/")) {
      requests.push(url.pathname);
      if (url.pathname.includes("raceprobe")) {
        await new Promise(resolve => setTimeout(resolve, 600));
        return route.fulfill({ json: { metas: [{ ...fixture()[0], name: "Stale Raceprobe Result" }] } });
      }
      if (url.pathname.includes("/slow")) await new Promise(resolve => setTimeout(resolve, 1600));
      if (url.pathname.includes("/stalled")) await new Promise(resolve => setTimeout(resolve, 15000));
      if (url.pathname.includes("/error") && failCatalog) return route.fulfill({ status: 503, json: { error: "Offline" } });
      return route.fulfill({ json: { metas: fixture(url.pathname.includes("/series/") ? "series" : "movie", url.pathname.includes("/slow") ? "Stale " : "") } });
    }
    if (url.pathname.endsWith("manifest.json")) return route.fulfill({ json: manifest });
    return route.fulfill({ json: { results: [], metas: [], result: [] } });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { document.documentElement.style.setProperty("--safe-top", "47px"); document.documentElement.style.setProperty("--safe-bottom", "24px"); });
  const dock = page.locator("[data-harbor-mobile-dock]");
  await dock.waitFor();
  await page.waitForTimeout(1600);
  assert.deepEqual(heavyPrefetches, [], "phone startup defers player and settings");
  const discover = page.locator('[data-mobile-page="discover"]');
  const library = page.locator('[data-mobile-page="library"]');
  await dock.getByRole("button", { name: "Discover", exact: true }).click();
  await discover.locator(".mobile-poster-card").nth(11).waitFor();
  const choose = async (surface, label, option) => {
    await surface.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
    const sheet = page.getByRole("dialog", { name: label, exact: true });
    await sheet.getByRole("option", { name: option }).click();
    await sheet.waitFor({ state: "hidden" });
  };
  await choose(discover, "Type", "Shows");
  await page.waitForFunction(() => document.querySelector('[data-mobile-page="discover"] .mobile-section-context')?.textContent.includes("Shows"));
  await choose(discover, "Type", "Movies");
  await choose(discover, "Catalog", "Slow catalog");
  await choose(discover, "Catalog", "Popular");
  await discover.locator(".mobile-poster-card").nth(11).waitFor();
  await page.waitForTimeout(1750);
  assert.equal(await discover.getByText(/^Stale /).count(), 0, "late old catalog cannot replace selected catalog");
  await choose(discover, "Genre", "Drama");
  await discover.locator(".mobile-poster-card").nth(11).waitFor();
  assert.ok(requests.some(url => url.includes("genre=Drama")));
  await choose(discover, "Catalog", "Unavailable");
  await discover.getByText("Couldn't load this catalog").waitFor();
  assert.equal(await discover.getByText("No titles found").count(), 0, "failure isn't an empty catalog");
  failCatalog = false;
  await discover.getByRole("button", { name: "Retry" }).click();
  await discover.locator(".mobile-poster-card").nth(11).waitFor();
  await choose(discover, "Catalog", "Stalled catalog");
  await discover.getByText("Couldn't load this catalog").waitFor({ timeout: 14000 });
  assert.equal(await discover.getByRole("status", { name: "Loading", exact: true }).count(), 0, "stalled catalog exits loading within deadline");
  assert.ok(await discover.getByRole("button", { name: "Retry" }).isVisible());
  await choose(discover, "Catalog", "Popular");
  await discover.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(800);
  assert.equal(await discover.locator(".mobile-poster-card").count(), 12, "duplicate pages don't duplicate titles");
  assert.equal(await discover.getByRole("button", { name: "Load more" }).count(), 0, "pagination stops when addon ignores skip");
  const savedScroll = await discover.evaluate(el => el.scrollTop);
  await dock.getByRole("button", { name: "My Library" }).click();
  await library.locator(".mobile-poster-card").nth(11).waitFor();
  await dock.getByRole("button", { name: "Discover", exact: true }).click();
  await page.waitForTimeout(450);
  assert.ok(Math.abs(await discover.evaluate(el => el.scrollTop) - savedScroll) < 4, "tab change preserves scroll");
  await dock.getByRole("button", { name: "My Library" }).click();
  await choose(library, "Type", "Movies");
  assert.equal(await library.locator(".mobile-poster-card").count(), 6);
  await choose(library, "Type", "All");
  await library.getByRole("searchbox").fill("Bocchi");
  assert.equal(await library.locator(".mobile-poster-card").count(), 1);
  await library.getByRole("searchbox").fill("");
  await choose(library, "Sort", "A-Z");
  assert.ok((await library.locator(".mobile-poster-title").first().textContent()).startsWith("A Quiet"));
  await mkdir("artifacts/qa-0.9.94", { recursive: true });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [name, surface] of [["My Library", library], ["Discover", discover]]) {
      await dock.getByRole("button", { name, exact: true }).click();
      await surface.evaluate(el => { el.scrollTop = 0; });
      await page.waitForTimeout(220);
      const metrics = await surface.evaluate(el => {
        const grid = el.querySelector(".mobile-poster-grid");
        const art = el.querySelector(".mobile-poster-art").getBoundingClientRect();
        return { columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length, gap: getComputedStyle(grid).columnGap, art: { x: art.x, width: art.width, height: art.height }, titleY: el.querySelector("h1").getBoundingClientRect().y, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.equal(metrics.columns, 3, `${name} at ${width}: three columns`);
      assert.equal(metrics.gap, "12px");
      assert.equal(metrics.art.x, 16);
      assert.ok(Math.abs(metrics.art.height / metrics.art.width - 1.5) < .02);
      assert.ok(metrics.titleY >= 47, "heading clears safe area");
      assert.equal(metrics.overflow, false);
      await page.screenshot({ path: `artifacts/qa-0.9.94/${name === "Discover" ? "discover" : "library"}-${width}.png` });
    }
  }
  const swipe = async (x1, x2) => page.locator("#root").evaluate((el, { x1, x2 }) => {
    const point = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 350 });
    for (const [type, x] of [["touchstart", x1], ["touchmove", x2], ["touchend", x2]]) el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === "touchend" ? [] : [point(x)], changedTouches: [point(x)] }));
  }, { x1, x2 });
  await swipe(300, 100);
  await library.waitFor({ state: "visible" });
  assert.equal(await library.locator(".mobile-poster-card").count(), 12, "swipe displays actual content");
  await page.waitForTimeout(500);
  assert.equal(await library.evaluate(el => el.getAnimations().filter(a => a.playState === "running").length), 0, "transition doesn't replay");
  await library.locator(".mobile-page-profile button").click();
  await library.waitFor({ state: "hidden" });
  await swipe(10, 160);
  await library.waitFor({ state: "visible" });
  await dock.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("raceprobe");
  await page.waitForTimeout(300);
  await search.getByRole("button", { name: "Clear", exact: true }).click();
  await page.waitForTimeout(800);
  assert.equal(await search.getByText("Stale Raceprobe Result").count(), 0);
  await search.getByRole("button", { name: "Close search" }).click();
  await dock.getByRole("button", { name: "More" }).click();
  assert.ok(await page.getByRole("dialog", { name: "More" }).getByRole("button", { name: "Live TV" }).isVisible());
  assert.deepEqual(errors, [], "no browser errors across the entire flow");
  console.log("PASS: populated grids 320/390/430px, filters, retry, cancellation, pagination, scroll, swipes, search");
} finally {
  await browser.close();
  await server.close();
}
