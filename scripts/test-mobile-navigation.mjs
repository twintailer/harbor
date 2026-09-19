// Exercise the actual mobile shell in a narrow browser viewport. The force
// flag enables the Tauri mobile layout without requiring an iPhone build.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { host: "127.0.0.1", port: 5174, strictPort: false, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: "msedge" });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "en-US" });
  const errors = [];
  const heavyPrefetches = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/src\/views\/(player|settings)\.tsx/.test(request.url())) heavyPrefetches.push(request.url());
  });
  await page.addInitScript(() => localStorage.setItem("harbor.forceMobileShell", "1"));
  await page.route("**/v3-cinemeta.strem.io/catalog/**", async (route) => {
    if (route.request().url().includes("raceprobe")) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ json: { metas: [{ id: "tt0000001", type: "movie", name: "Stale Raceprobe Result" }] } });
      return;
    }
    await route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: "domcontentloaded" });

  const dock = page.locator("[data-harbor-mobile-dock]");
  await dock.waitFor();
  const profileTarget = await page.locator("header.fixed button").first().boundingBox();
  assert.ok(profileTarget && profileTarget.width >= 44 && profileTarget.height >= 44, "profile entry has a 44px touch target");
  await page.waitForTimeout(1600);
  assert.deepEqual(heavyPrefetches, [], "mobile startup defers the large player and settings views");
  assert.deepEqual(await dock.locator("button").allTextContents(), ["Home", "Discover", "Search", "My Library", "More"]);
  await dock.getByRole("button", { name: "More" }).click();
  const more = page.getByRole("dialog", { name: "More" });
  await more.waitFor();
  for (const room of ["Movies", "Shows", "Anime", "Downloads", "Addons", "Settings"]) {
    assert.equal(await more.getByRole("button", { name: room, exact: true }).count(), 1, `${room} reachable from phone dock`);
  }
  await more.getByRole("button", { name: "Movies", exact: true }).click();
  await more.waitFor({ state: "hidden" });
  assert.equal(await dock.getByRole("button", { name: "More" }).getAttribute("aria-expanded"), "false");

  await dock.getByRole("button", { name: "Search" }).click();
  const search = page.getByRole("dialog", { name: "Search" });
  await search.waitFor();
  const searchBackTarget = await search.getByRole("button", { name: "Close search" }).boundingBox();
  assert.ok(searchBackTarget && searchBackTarget.width >= 44 && searchBackTarget.height >= 44, "search back has a 44px touch target");
  await search.getByRole("textbox").fill("raceprobe");
  await page.waitForTimeout(250); // let the request start before clearing
  await search.getByRole("button", { name: "Clear" }).click();
  await page.waitForTimeout(650);
  assert.equal(await search.getByText("Stale Raceprobe Result").count(), 0, "clearing input rejects late results");
  assert.equal(await search.getByRole("textbox").inputValue(), "");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "phone layout has no horizontal page overflow");
  await search.getByRole("button", { name: "Close search" }).click();
  await page.setViewportSize({ width: 320, height: 700 });
  await dock.getByRole("button", { name: "More" }).click();
  const smallMore = page.getByRole("dialog", { name: "More" });
  assert.ok(await smallMore.getByRole("button", { name: "Live TV" }).isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "small iPhone layout fits");
  await page.evaluate(() => window.dispatchEvent(new Event("harbor:local-back", { cancelable: true })));
  await smallMore.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log("PASS (Edge): mobile rooms reachable, More closes after navigation, stale search discarded, 390px and 320px layouts fit");
} finally {
  await browser.close();
  await server.close();
}
