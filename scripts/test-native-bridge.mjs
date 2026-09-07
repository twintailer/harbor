import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
async function bundle(entry, plugins = []) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node", plugins });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const handlers = new Map();
const invocations = [];
const removed = [];
let holdRegistration;
globalThis.nativeTest = {
  invoke: async (cmd, args) => { invocations.push([cmd, args]); },
  addPluginListener: async (_plugin, event, callback) => {
    if (holdRegistration) await holdRegistration;
    handlers.set(event, callback);
    return { unregister: async () => { removed.push(event); handlers.delete(event); } };
  },
};
globalThis.document = { documentElement: { dataset: {} } };
const { createNativeBridge } = await bundle("src/lib/player/native.ts", [{
  name: "native-test-host",
  setup(build) {
    build.onResolve({ filter: /^(@tauri-apps\/api\/core|@\/lib\/mobile-debug)$/ }, args => ({ path: args.path, namespace: "test-host" }));
    build.onLoad({ filter: /.*/, namespace: "test-host" }, args => ({ contents: args.path.includes("mobile-debug") ? "export const mlog = () => {};" : "export const { invoke, addPluginListener } = globalThis.nativeTest;" }));
  },
}]);
let latest;
const bridge = createNativeBridge();
bridge.attach();
bridge.subscribe(snap => { latest = snap; });
await bridge.load({ url: "https://example.invalid/test.mkv" });
assert.deepEqual([...handlers.keys()], ["debug", "status", "time"], "listeners ready before native load");
const audio = [{ id: 1, label: "German", lang: "de", selected: true }];
handlers.get("status")({ status: "playing", audioTracks: audio, durationSec: 120 });
const oldTracks = latest.audioTracks;
handlers.get("time")({ positionSec: 11, durationSec: 120 });
assert.equal(latest.positionSec, 11);
assert.equal(latest.audioTracks, oldTracks);
handlers.get("status")({ status: "paused", audioTracks: structuredClone(audio) });
assert.equal(latest.audioTracks, oldTracks, "clock and status don't rebuild identical track lists");
handlers.get("status")({ status: "loading", buffering: true });
handlers.get("time")({ positionSec: 12 });
assert.equal(latest.status, "loading");
assert.equal(latest.buffering, true, "time event cannot falsely clear buffering");
assert.equal(latest.audioTracks, oldTracks, "partial events preserve tracks");
handlers.get("status")({ status: "playing", anime4kSuspendedReason: "temperature", videoDecoder: "software" });
assert.equal(latest.anime4kSuspendedReason, "temperature");
assert.equal(latest.videoDecoder, "software");
await bridge.prepareExit();
bridge.destroy();
assert.equal(invocations.filter(([cmd]) => cmd.endsWith("|stop")).length, 0, "prepared exit doesn't stop twice");
assert.ok(removed.includes("time") && removed.includes("status"));
// Async creation cancelled before attach must unregister a late listener,
// without stopping the newer shared native player or hiding its video surface.
let release;
holdRegistration = new Promise(resolve => { release = resolve; });
const cancelled = createNativeBridge();
document.documentElement.dataset.nativeVideo = "1";
cancelled.destroy();
release();
await cancelled.load({ url: "https://example.invalid/cancelled.mkv" });
assert.equal(document.documentElement.dataset.nativeVideo, "1");
assert.equal(invocations.filter(([cmd]) => cmd.endsWith("|load")).length, 1);
assert.equal(invocations.filter(([cmd]) => cmd.endsWith("|stop")).length, 0);
assert.ok(removed.includes("debug"));
const { anime4kMobileFiles, anime4kFiles } = await bundle("src/lib/player/anime4k-modes.ts");
for (const mode of ["A", "B", "C", "AA", "BB", "CA"]) {
  assert.deepEqual(anime4kMobileFiles(mode, 0, 1920), []);
  assert.deepEqual(anime4kMobileFiles(mode, 3840, 1920), []);
  const files = anime4kMobileFiles(mode, 1280, 1920);
  assert.ok(files.length <= 3);
  assert.ok(files.every(file => !/_(M|VL)\.glsl$/.test(file)));
  assert.ok(files.filter(file => file.includes("Upscale")).length <= 1);
  assert.ok(!anime4kMobileFiles(mode, 1920, 1920).some(file => file.includes("Upscale")));
}
assert.ok(anime4kFiles("AA", "hq").some(file => file.includes("_VL")), "desktop quality chains unchanged");
console.log("PASS: native event clock, buffering, stable tracks, thermal/decoder metadata, teardown, cancelled registration, all mobile shader presets");

const catalogs = Array.from({ length: 13 }, (_, i) => ({ id: String(i), name: `Catalog ${i}`, type: "series" }));
let active = 0;
let peak = 0;
let requests = 0;
globalThis.catalogTest = {
  installed: [{ transportUrl: "https://metadata.invalid/manifest.json", manifest: { id: "test.metadata", name: "Metadata", resources: ["meta", "catalog"], catalogs } }],
  fetch: async (url) => {
    requests++;
    active++;
    peak = Math.max(peak, active);
    const index = Number(url.match(/\/(\d+)\.json$/)[1]);
    await new Promise(resolve => setTimeout(resolve, (3 - index % 4) * 4));
    active--;
    return new Response(JSON.stringify({ metas: [{ id: String(index), name: `Title ${index}`, type: "series" }] }));
  },
};
const { loadAddonRows } = await bundle("src/lib/addons.ts", [{
  name: "catalog-test-host",
  setup(build) {
    build.onResolve({ filter: /^(\.\/addon-store|@\/lib\/safe-fetch)$/ }, args => ({ path: args.path, namespace: "catalog-host" }));
    build.onLoad({ filter: /.*/, namespace: "catalog-host" }, args => ({ contents: args.path.includes("addon-store")
      ? "export const filterEnabled = rows => rows; export const loadInstalled = () => globalThis.catalogTest.installed; export const fetchManifestAt = async () => null;"
      : "export const safeFetch = (...args) => globalThis.catalogTest.fetch(...args);" }));
  },
}]);
const batches = [];
const rows = await loadAddonRows(null, { metadataOnly: true, dedup: false, onRows: rows => batches.push(rows.length) });
assert.equal(peak, 4);
assert.deepEqual(batches, [4, 8, 12, 13]);
assert.deepEqual(rows.map(row => row.metas[0].id), catalogs.map(row => row.id), "completion order cannot reorder catalogs");
requests = 0;
const abort = new AbortController();
await loadAddonRows(null, { metadataOnly: true, signal: abort.signal, onRows: () => abort.abort() });
assert.equal(requests, 4, "suspending home stops scheduling subsequent batches");
requests = 0;
await loadAddonRows(null, { metadataOnly: true, signal: abort.signal });
assert.equal(requests, 0, "already aborted catalogs never start");
console.log("PASS: metadata catalog concurrency <= 4, progressive batches, stable ordering, cancellation");
