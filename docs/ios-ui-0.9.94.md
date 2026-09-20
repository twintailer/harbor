# iOS UI 0.9.94

Discover now has a dedicated phone catalog browser. Library uses the same phone
metrics: 16 px side insets, three 2:3 posters per row, 12 px column gaps,
14/18 px two-line titles, 44 px controls and bottom-sheet selectors. These
layouts were independently implemented using the local Nuvio reference's
mobile proportions; no Nuvio source or assets were imported.

Desktop Discover remains separate. Mobile Watchlist and History have compact
filters, explicit loading/error states and retry actions. The desktop logo
overlay and top gradient no longer cover the phone page headings.

Catalog requests and library synchronization have a 12-second UI deadline.
Native HTTP observes consumer cancellation, does not retry cancelled or timed
out requests, and reuses its Rust HTTP client. Cancelling an invoke stops the
consumer immediately; the underlying Rust request is still bounded by its
30-second transport timeout. Concurrent Stremio library reads are shared.
Catalog pages are deduplicated and pagination stops if an addon ignores skip.

Mobile tabs preserve scroll and loaded data. Navigation direction no longer
resets on a timer that replayed the entrance animation. Large secondary library
tabs load on demand; phone startup no longer preloads desktop Discover, detail
and stream-picker bundles.

## Verification

- `pnpm build`
- `pnpm test:mobile-navigation`: deterministic populated catalog/library at
  320, 390 and 430 px, simulated safe areas, filter sheets, search/sort, failed
  catalog and retry, stale response cancellation, duplicate pagination, scroll
  preservation, tab/edge-back swipes, no page errors across the full flow.
- `pnpm test:mobile-network`: stuck operation deadline, native abort, no retry
  after timeout/cancellation, GET fallback, no write replay, empty HTTP 204.
- `pnpm test:player-bridge` and `pnpm test:player-mobile`.

Screenshots use synthetic poster fixtures and are saved under
`artifacts/qa-0.9.94/`. Browser checks run in Edge with Harbor's mobile-shell
flag; they do not establish physical iPhone frame rates or WKWebView rendering.
The unsigned IPA is built separately with Xcode on the public-repository macOS
runner, guarded against private-repository minute usage.
