// Headless integration test of the actual touch shell, not a copy of its logic.
// PLAYWRIGHT_MODULE_PATH may point to a preinstalled playwright/index.mjs.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : "playwright");
const useWebkit = process.env.HARBOR_TEST_BROWSER === "webkit";
const server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false, open: false } });
await server.listen();
const browser = await (useWebkit ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, channel: "msedge" }));
try {
  const page = await browser.newPage({ viewport: { width: 852, height: 393 }, hasTouch: true, deviceScaleFactor: 1, locale: "en-US" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/mobile-player.html`);
  const timeline = page.getByRole("slider", { name: "Playback position" });
  await timeline.waitFor();
  await page.evaluate(() => window.testPlayer.clock(42, 80));
  await page.waitForFunction(() => document.querySelector('input[type="range"]').value === "42");
  await page.evaluate(() => window.testPlayer.clock(43.5, 85));
  await page.waitForFunction(() => document.querySelector('input[type="range"]').value === "43.5");
  assert.equal(await timeline.getAttribute("aria-valuetext"), "0:43 / 1:00:00");
  assert.equal(await page.evaluate(() => window.testPlayer.calls.filter(c => c[0] === "playPause").length), 0);
  // Pause isn't involved: snapshot identity remains unchanged for both ticks.
  await page.getByRole("button", { name: "Next episode", exact: true }).tap();
  await page.getByRole("button", { name: "Back", exact: true }).tap();
  await page.getByRole("button", { name: "Source", exact: true }).tap();
  await page.getByRole("button", { name: "Audio: German" }).tap();
  await page.getByRole("button", { name: "English" }).tap();
  assert.equal(await page.getByRole("dialog").count(), 0, "track selection closes immediately");
  // Seek in progress doesn't jump underneath the user's finger as time ticks.
  const bounds = await timeline.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height / 2);
  const scrubbingValue = await timeline.inputValue();
  await page.evaluate(() => window.testPlayer.clock(44, 86));
  assert.equal(await timeline.inputValue(), scrubbingValue);
  await page.mouse.up();
  assert.ok((await page.evaluate(() => window.testPlayer.calls)).some(c => c[0] === "seek" && c[1] > 1500));
  // Hiding must remove touch targets and subscriptions, including the central
  // buttons which have explicit pointer-events:auto.
  await page.evaluate(() => window.testPlayer.setVisible(false));
  await page.waitForFunction(() => document.querySelector('.mobile-player-shell').inert);
  const hiddenInput = page.locator('input[type="range"]');
  const oldValue = await hiddenInput.inputValue();
  await page.evaluate(() => window.testPlayer.clock(55, 90));
  assert.equal(await hiddenInput.inputValue(), oldValue, "hidden timeline stays unsubscribed");
  await page.touchscreen.tap(426, 196);
  const calls = await page.evaluate(() => window.testPlayer.calls);
  for (const name of ["next", "back", "source", "audio", "surface"]) assert.ok(calls.some(c => c[0] === name), name);
  assert.equal(calls.filter(c => c[0] === "playPause").length, 0, "hidden play control cannot steal tap");
  await page.evaluate(() => window.testPlayer.setVisible(true));
  await page.waitForFunction(() => document.querySelector('input[type="range"]').value === "55");
  await mkdir("artifacts/mobile-player-review", { recursive: true });
  await page.screenshot({ path: `artifacts/mobile-player-review/player${useWebkit ? "-webkit" : ""}.png` });
  await page.evaluate(() => window.testPlayer.setLimit("temperature"));
  await page.getByRole("button", { name: "Anime4K", exact: true }).tap();
  assert.ok(await page.getByText("Anime4K paused for this video", { exact: false }).isVisible());
  await page.screenshot({ path: `artifacts/mobile-player-review/anime4k${useWebkit ? "-webkit" : ""}.png` });
  await page.getByRole("button", { name: "Light Single denoise / upscale network" }).tap();
  assert.equal(await page.getByRole("dialog").count(), 0, "last option is reachable in a short landscape sheet");
  await page.getByRole("button", { name: "Anime4K", exact: true }).tap();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  // React Activity suspends background effects without losing navigation UI state.
  await page.evaluate(() => { window.testPlayer.setVisible(false); window.testPlayer.setBackground(true); });
  await page.locator("#background-state").evaluate(el => el.click());
  await page.evaluate(() => window.testPlayer.setBackground(false));
  await page.waitForFunction(() => window.testPlayer.calls.some(c => c[0] === "backgroundStop"));
  await page.evaluate(() => window.testPlayer.setBackground(true));
  await page.waitForFunction(() => document.querySelector('#background-state').textContent === "1");
  assert.deepEqual(errors, []);
  console.log(`PASS (${useWebkit ? "WebKit" : "Edge"}): live timeline, gated updates, scrubbing, next/back/source, audio menu, hidden hit targets, thermal notice, scrollable sheet, Activity state/effects`);
} finally {
  await browser.close();
  await server.close();
}
