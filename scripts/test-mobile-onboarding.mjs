import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { host: "127.0.0.1", port: 5175, strictPort: false, open: false } });
await server.listen();
const browser = await chromium.launch({ headless: true, channel: "msedge" });

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, locale: "en-US" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("harbor.forceMobileShell", "1"));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-top", "44px");
    document.documentElement.style.setProperty("--safe-bottom", "24px");
  });
  const start = page.getByRole("button", { name: "Get Started" });
  await start.waitFor({ timeout: 15000 });
  const modal = start.locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  const dock = page.locator("[data-harbor-mobile-dock]");
  assert.ok(await modal.evaluate((element) => Number(getComputedStyle(element).zIndex)) > await dock.evaluate((element) => Number(getComputedStyle(element).zIndex)), "onboarding covers the phone dock");
  const labels = await Promise.all(["Current", "Yours", "Quiet"].map(async (label) => page.getByText(label, { exact: true }).boundingBox()));
  assert.ok(labels.every(Boolean) && labels[0].y < labels[1].y && labels[1].y < labels[2].y, "welcome cards stack on a narrow phone");
  const startBox = await start.boundingBox();
  assert.ok(startBox && startBox.y + startBox.height <= 700 - 24, "setup action stays above the home indicator");
  await mkdir("artifacts/mobile-onboarding-review", { recursive: true });
  await page.screenshot({ path: "artifacts/mobile-onboarding-review/welcome.png" });
  await start.click();
  await page.getByText("Pick a home layout").waitFor();
  await page.getByText("Classic Stremio", { exact: true }).first().scrollIntoViewIfNeeded();
  assert.ok(await page.getByRole("button", { name: "Continue", exact: true }).isVisible(), "layout step keeps its next action available");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "onboarding fits the phone width");
  await page.screenshot({ path: "artifacts/mobile-onboarding-review/layout.png" });
  assert.deepEqual(errors, []);
  console.log("PASS (Edge): iPhone onboarding overlays dock, stacks cards, scrolls steps and preserves safe-area actions");
} finally {
  await browser.close();
  await server.close();
}
