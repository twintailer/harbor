import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
let invokeCalls = 0, fallbackCalls = 0;
let handler = async () => ({ status: 200, body: '{}', contentType: 'application/json' });
globalThis.window = { __TAURI_INTERNALS__: {} };
globalThis.networkTest = {
  invoke: (...args) => { invokeCalls++; return handler(...args); },
  fetch: async () => { fallbackCalls++; return new Response('fallback'); },
};
const result = await build({ entryPoints: ['src/lib/safe-fetch.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{
  name: 'native-host', setup(build) {
    build.onResolve({ filter: /(@tauri-apps\/api\/core|@tauri-apps\/plugin-http|privacy\/blocklist)$/ }, args => ({ path: args.path, namespace: 'host' }));
    build.onLoad({ filter: /.*/, namespace: 'host' }, args => ({ contents: args.path.includes('blocklist') ? 'export class TrackerBlockedError extends Error {}; export const isBlockedUrl = () => false; export const noteBlocked = () => {};' : 'export const { invoke, fetch } = globalThis.networkTest;' }));
  }
}] });
const { safeFetch } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const deadlineBundle = await build({ entryPoints: ['src/lib/request-deadline.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { withDeadline } = await import(`data:text/javascript;base64,${Buffer.from(deadlineBundle.outputFiles[0].text).toString('base64')}`);
await assert.rejects(withDeadline(new Promise(() => {}), 20), { name: 'TimeoutError' });
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(safeFetch('https://example.test/', { signal: cancelled.signal }), { name: 'AbortError' });
assert.equal(invokeCalls, 0, 'pre-cancelled requests never invoke native HTTP');
let resolveLate;
handler = () => new Promise(resolve => { resolveLate = resolve; });
const controller = new AbortController();
const pending = safeFetch('https://example.test/', { signal: controller.signal });
controller.abort();
await assert.rejects(pending, { name: 'AbortError' });
assert.equal(fallbackCalls, 0, 'abort does not create a second HTTP request');
resolveLate({ status: 200, body: '{}', contentType: 'application/json' });
await Promise.resolve();
handler = async () => { throw new DOMException('Timeout', 'TimeoutError'); };
await assert.rejects(safeFetch('https://example.test/'), { name: 'TimeoutError' });
assert.equal(fallbackCalls, 0, 'timeout does not retry');
handler = async () => { throw new Error('transport unavailable'); };
assert.equal(await (await safeFetch('https://example.test/')).text(), 'fallback');
assert.equal(fallbackCalls, 1, 'idempotent transport errors retain fallback');
await assert.rejects(safeFetch('https://example.test/', { method: 'POST', body: '{}' }), /transport unavailable/);
assert.equal(fallbackCalls, 1, 'writes never replay');
handler = async () => ({ status: 204, body: '', contentType: null });
assert.equal((await safeFetch('https://example.test/')).status, 204);
console.log('PASS: deadlines, immediate native cancellation, no retry on abort/timeout, safe GET fallback, no write replay, 204 responses');
