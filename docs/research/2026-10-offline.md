# Offline cold start stuck on "loading": review of the investigator hypotheses

> **Update after this review:** the owner confirmed the failing device is an
> installed Android PWA and that it fails on *every* offline cold start. That
> points first to H2 (the Serwist install never completes, so the legacy
> hand-written SW stays in control), with H1 and H3 as aggravating factors.
> `docs/roadmap.md` (PR 1a/1b/1c) carries the fix plan adjusted to that answer.

## 0. What I re-checked, and what I'm correcting

**Repo claims I confirmed:**
- `src/stores/app/use-expense-store.ts:69-75` renders `null` until `isHydrated`. Because of that the prerendered HTML has an empty `<body>`, and no boot splash has existed since `3df479d`.
- Hydration does not block anything. `use-store-persistence.ts:158` runs `hydrateLocalSnapshot()` synchronously in the first effect. `loadExpenseStore` and `saveExpenseStore` are fully try/caught (`local-store.ts:10-31`). Supabase auth (`:160-181`) is async and starts after hydration. **If the screen stays empty, JS either never ran or the document never arrived.**
- `src/pwa/sw.ts:116-133` sets `navigationPreload: true`. `precacheOptions` has no `ignoreURLParametersMatching`. Only documents get the `/` fallback. There is no legacy-cache cleanup and no network timeouts beyond NetworkFirst's 3 s race.
- `PwaRegister.tsx:22-26` registers on `load` and swallows errors with `.catch(() => {})`.
- The old SW (`git show 95c2f24^:public/sw.js`) answered navigations network-first with a `caches.match('/')` fallback and sent `/_next/*` to the network with no cache. **Offline JS never worked before 23 Aug 2026.**
- `public/app-icon-1024.png` is 1.27 MB, is referenced nowhere, and is precached through `public/**/*`.
- `docs/platform.md` mentions a "Rate limit externo configurado en Vercel Firewall". If that rule covers more than the AI endpoint, it is a possible source of precache 429s.
- Production could not be reached from the sandbox (proxy 403). **Nothing about the production HTML or `/sw.js` has been checked.**

**Serwist 9.5.12 and Next 16.3.2 claims I confirmed (in the scratchpad clones at those exact tags):**
- `PrecacheStrategy._handle` awaits `handler.getPreloadResponse()` before `cacheMatch`, with no timeout (`PrecacheStrategy.ts:81-90`, `StrategyHandler.ts:504-522`).
- `PrecacheRoute` is registered before `runtimeCaching` (`Serwist.ts:208` vs `:247`).
- `NetworkFirst` returns `(await race) || (await networkPromise)`. So when the timeout fires and the cache has nothing, it waits on the network forever.
- Install is all-or-nothing: any response with status ≥400 throws `bad-precaching-response`.
- The default `ignoreURLParametersMatching` is `[/^utm_/, /^fbclid$/]`.
- `disableNavigationPreload` is exported. `navigationPreload: false` on its own does not clear the flag, because the flag lives on the registration.
- `NEXT_DEPLOYMENT_ID` (which produces `?dpl=`) is set by the Vercel builder or adapter **only** when `VERCEL_SKEW_PROTECTION_ENABLED==='1'` (`vercel/packages/next/src/index.ts:529-537`, `adapter/src/index.ts:54-62`).
- With immutable assets, hashed chunks are served at `/_next/static/immutable/*` with no `dpl`. That is the same path as on disk, so they **do** match precache keys.
- `NEXT_HASH_SALT` changes every chunk hash. That makes it useful for simulating a deploy in tests.

**Corrections to the investigators:**
1. With `navigationPreload: true`, an **online** navigation to a precached route is answered by the **preload network response**, not by the precached HTML. Two investigators said "the active SW serves its own precached HTML online", and that is wrong. As a result, after any online visit made under SW control, that route's `?dpl=` chunks end up in the `next-static` runtime cache. The dpl failure is therefore narrower than they described. **But** once preload is turned off (fix 1), the dpl mismatch fails reliably after every deploy. **The two fixes must ship together.**
2. dpl needs Pro or Enterprise with Skew Protection. A daily-only cron (`vercel.json`) and a personal project both point to Hobby. A 10-second `curl` settles it.
3. The passing e2e is weak evidence:
   - Chromium's `context.setOffline` does not cut fetches the SW itself makes (playwright#2311), so a cache miss can be served quietly by the live `next start` server.
   - The browser is never restarted.
   - There is no deploy, no `dpl`, and no WebKit.
   - Chromium's offline mode fails the preload **immediately**, so the test can never expose a hang.

---

## 1. Ranked root-cause hypotheses (duplicates merged)

### H1. Navigation preload plus unbounded network waits: an offline or weak-network cold launch never reaches the cache, especially on iOS
- **Likelihood:** High if the owner uses an iPhone home-screen app, medium overall.
- **How it fails:**
  1. The app is launched at `/`.
  2. `PrecacheRoute` matches, then `PrecacheStrategy` runs `await event.preloadResponse`.
  3. In Chromium "offline" the preload rejects at once, the cache is served, and it works. That is the e2e case.
  4. On iOS the preload request can **hang** instead of failing: weak signal, captive Wi-Fi, or iOS network waits.
  5. The precached HTML is never returned. The standalone app shows its black or white launch screen forever, which reads as "se queda en el loading inicial".
  6. The same unbounded wait exists in `pages` (NetworkFirst after timeout plus cache miss), `next-static` (CacheFirst on a miss), and SWR on a miss.
  7. The `/` document fallback only fires on an *error*, so a hang never reaches it.
  8. Side effect: WebKit can keep never-settling fetch events open, which leaves new SWs stuck in `waiting`. That feeds H2.
- **Evidence:**
  - Confirmed in code: the file and line references in section 0.
  - External reports, each a single source: [helprr#428](https://github.com/SaiBarathR/helprr/pull/428) (22 Oct 2026, Serwist on an installed iPhone app; WebKit cancels the preload and `preloadResponse` never settles; reproduced 3 of 3 times on the iOS Simulator; fixed with `disableNavigationPreload()`), [openGym#274](https://github.com/DuarteSantos8/openGym/issues/274) (iOS 26.6.2 home-screen app, offline cold launch goes black then white forever; the SW network fetch hangs instead of failing; fixed with a 3 s timeout; not about preload specifically), and WebKit bug [258196](https://bugs.webkit.org/show_bug.cgi?id=258196) ("Navigation Preload promise never resolves", still NEW).
  - Inference: in true airplane mode on a healthy WebKit the preload should reject. The iOS 26 report suggests it may hang anyway.
- **What would falsify it:**
  - On the device, airplane mode **and** Network Link Conditioner "100% Loss" both serve the document from the SW in under 1 s.
  - The "blackhole" e2e (section 2, S1-B) passes with the current `sw.ts`.
  - `registration.navigationPreload.getState()` reports `enabled:false` and it still fails.

### H2. The device isn't running a healthy, current Serwist SW
- **Likelihood:** Medium.
- **Ways this can happen (merged from three investigators):**
  - **(a)** The legacy `expense-reminders-v6` SW still controls the home-screen container. Offline it serves its cached HTML and every `/_next/*` request fails, so the screen is blank. This is the same symptom.
  - **(b)** The Serwist install keeps failing. It is all-or-nothing: any ≥400 response fails it, for example a Vercel Firewall rate limit or challenge during the burst of 10 concurrent requests, or a `/settings?from=*` 5xx.
  - **(c)** iOS suspends the app before the large precache finishes. The precache covers all of `.next/static`, all of `public/**` including the unused 1.27 MB icon, and the HTML.
  - **(d)** The home-screen app has its own storage, separate from Safari. If it was re-added it starts empty.
  - **(e)** A newer SW is stuck in `waiting` because of H1.
  - `PwaRegister` swallows every error, so none of this would ever show up.
- **Evidence:** Confirmed in code (old `sw.js`, `PrecacheStrategy.ts:178-197`, `PwaRegister.tsx:24`). Whether the device is in this state is unknown.
- **What would falsify it:** Web Inspector on the home-screen target shows an active Serwist script, `caches.keys()` includes `serwist-precache-v2-…` with no `expense-reminders-v6`, `waiting` and `installing` are null, and the precache key count matches the build log's "will precache N URLs".

### H3. Vercel Skew Protection `?dpl=` doesn't match the precache keys
- **Likelihood:** Low to medium, and only if the precondition holds.
- **How it fails:** The precache keys are `/_next/static/chunks/X.js`. The HTML requests `X.js?dpl=…`, which misses the precache and falls through to `next-static`. That cache only holds chunks fetched during an online visit made under SW control.
- **When it fails today:** the first offline launch right after the first install (the first page load wasn't controlled), routes or lazy chunks not opened online since the last deploy, and entries evicted by `maxEntries`. The Chromium HTTP cache (`immutable`) often hides it. iOS eviction doesn't.
- **After fix 1 (preload off):** it fails reliably after every deploy.
- **Evidence:** Confirmed in code (section 0). The precondition is probably false (Hobby signals). A third-party case: [room-tba#1219](https://github.com/uplbtools/room-tba/pull/1219).
- **What would falsify it:** `curl -s https://<prod>/ | grep -c 'dpl='` returns 0, or the assets are served under `/_next/static/immutable/`.

### H4. Amplifier, certain: an empty SSR body, no `global-error.tsx`, and swallowed SW errors
Every failure above looks like "infinite loading" and cannot be diagnosed on the device. This is not a root cause, but it must be fixed in any case.

### H5. A test-procedure artefact
- **Likelihood:** Low to medium.
- **Ways this can happen:**
  - The owner tested on `npm run dev`. `PwaRegister.tsx:9-18` **unregisters the SW and deletes the caches** in dev.
  - The owner tested on a preview or other origin.
  - The owner tested in a Safari tab instead of the home-screen container.
  - DevTools "Bypass for network" was on.
  - The owner went offline before the first install finished.
- **What would falsify it:** the owner's answers in section 4.

### H6. Stale `pages` runtime HTML for routes that aren't precached
- **Likelihood:** Low.
- **How it fails:** `/expenses/[id]` is cached as old-build HTML. On activation, the precache entries for the old chunks are deleted, so the old HTML points at chunks that no longer exist anywhere.
- **Scope:** This only explains failures on detail routes, not on `/`.

### H7. Build pipeline problems
- **Likelihood:** Low.
- **How it fails:** `/sw.js` is missing because the Build Command was overridden, or the manifest is empty because `NODE_ENV=development` set `disablePrecacheManifest`. (Vercel copies post-build `public/` files, per vercel#15780.)
- **What would falsify it:** the build log line "The service worker will precache N URLs", plus the `curl` checks in section 2.

### H8. Cosmetic only
`next/font` woff2 files are not in the glob, and `?v=5` icon URLs miss the precache. Neither blocks rendering.

### H9. Very unlikely
The Android Chrome M143 auto-preload regression (fixed).

**Ruled out:** a hydration or auth wait, or a localStorage throw. One separate bug turned up: a corrupt localStorage value gets overwritten with `emptyStore` (`use-store-persistence.ts:65-66`), which is a data-loss risk.

---

## 2. Reproduction plan: run these FIRST, before changing any code

### 2.0 Production checks (about 60 s, once the owner gives the domain)
```bash
curl -sI https://<prod>/sw.js                                   # 200, javascript, max-age=0
curl -s  https://<prod>/sw.js | grep -c expense-reminders-v6     # must be 0
curl -s  https://<prod>/sw.js | grep -oE '"?url"?:"/[^"]*"' | grep -v _next   # "/", "/money", "/login", "/expenses/new", "/settings…"
curl -s  https://<prod>/sw.js | grep -o '/_next/static/' | wc -l  # well above 0
curl -s  https://<prod>/ | grep -oE '/_next/static/[^"]+' | sort -u | head   # ?dpl= vs /immutable/  (decides H3)
curl -s  https://<prod>/ | grep -o 'data-dpl-id="[^"]*"'
```
Then extract every precache URL from `sw.js` and fetch them **10 at a time** with `xargs -P10 curl -s -o /dev/null -w '%{http_code} %{url}\n'`. Any 429, 403 or 5xx confirms H2(b). Also look for "will precache N URLs" in the Vercel build log.

### 2.1 Harness: `playwright.offline.config.ts`, `workers: 1`, no `webServer`
- **globalSetup** builds snapshots into `.e2e-builds/<name>/` (copies of `.next/` and `public/sw.js`; add the folder to `.gitignore`):
  - `A`: `npm run build`
  - `B`: `NEXT_HASH_SALT=e2e-b npm run build` (every chunk hash changes, which behaves like a real deploy)
  - `DPL-A`: `NEXT_DEPLOYMENT_ID=dpl_e2e_a npm run build`
  - `DPL-B`: `NEXT_DEPLOYMENT_ID=dpl_e2e_b NEXT_HASH_SALT=e2e-b npm run build`
- **Server fixture** on a fixed origin (`127.0.0.1:3200`, because the SW is tied to the origin):
  - `deploy(name)`: only while the server is stopped. Restore the snapshot into `./.next` and `./public/sw.js`.
  - `start(env)`: spawn `next start`. Pass `NEXT_DEPLOYMENT_ID` for DPL builds.
  - `stop()`
  - `goOffline(mode)`, with three modes:
    - `dead`: kill the server. The port refuses connections, which behaves like airplane mode.
    - `blackhole`: `net.createServer(() => {}).listen(3200)` accepts connections and never responds. This models lie-fi or an iOS network hang.
    - `emulated`: `context.setOffline(true)` plus `context.route('**/*', r => r.abort('internetdisconnected'))`. The route also catches requests made by the SW (`request.serviceWorker()`).
- **Browser:** `playwright[browser].launchPersistentContext(userDataDir, {...device, defaultBrowserType: undefined})`. Seed `demoStore` with `addInitScript`, as in the current spec.
  - **"Ready" means:** `navigator.serviceWorker.controller` is set, `(await getRegistration()).active.state === 'activated'`, and `waiting` and `installing` are both null. Activation only happens after the install (and therefore the precache) succeeds.
  - **"Boot" assertion:** within **5 s**, a route-specific locator is visible ("Por pagar", or the h1 "Plan de"/"Ajustes"), `.app-hydrated-content` exists, and `page.on('requestfailed')` recorded nothing under `/_next/static/`.
- **Projects:**
  - `chromium-pixel7`: `devices['Pixel 7']`
  - `webkit-iphone`: `devices['iPhone 15']`
  - On WebKit, use only the `dead` and `blackhole` modes. `setOffline` breaks SW-served requests in WebKit before Playwright 1.64 ([playwright#42775](https://github.com/microsoft/playwright/issues/42775), fixed by PR #42894). If the WebKit runner never gets SW control, use `test.skip` with a reason; don't record a pass.
  - Playwright's WebKit is **not** iOS's network stack, so the device checklist is still required.

### 2.2 Scenarios

| ID | Steps | Expected on current code | Decides |
|---|---|---|---|
| S1-dead | Build A. Fresh profile. Open `/` online **once** (no reload). Wait for ready. Close the context. `dead`. Relaunch with the same profile. For each of `/`, `/money`, `/settings?from=money`, `/expenses/new`, `/login`, open a new page with `goto(url,{waitUntil:'commit'})` and run the boot assertion. | Chromium probably passes (baseline) | precache completeness |
| **S1-blackhole** | Same as S1-dead but with `blackhole` | **Fails (hang)** | **H1** |
| S2-update | Build A online and ready. Close. `stop`, `deploy(B)`, `start`. Relaunch and open `/` online once. Wait until the precache keys include `__WB_REVISION__=<B BUILD_ID>` (`/settings` entry) and the SW is activated. Close. `dead` and `blackhole`. Relaunch. Boot `/` and `/money`. Assert `document.documentElement.innerHTML.includes(buildIdB)`. | dead passes, blackhole fails | update path |
| S2-noVisit | Like S2-update, but skip the online visit after deploying B | Boots A offline | stale-SW safety |
| S2-detail | Under A online, open `/expenses/<demo id>`. Deploy B, visit online, wait for ready. Go offline and open `/expenses/<id>` | Blank or hang possible | **H6** |
| S3-dpl | First check that `request.get('/')` HTML contains `?dpl=dpl_e2e_a`; fail fast otherwise. Run S1 and S2 with the DPL builds. On Chromium, run a variant that calls `Network.clearBrowserCache` over CDP before going offline (models iOS cache eviction). | S1 with cleared cache **fails** | **H3** |
| S4 | Existing `offline.spec.ts`, switched to `emulated` mode (setOffline **plus** route abort) | Show whether misses were being served by the live server | e2e trust |

### 2.3 Manual iPhone checklist (Safari Web Inspector)
1. **Setup:** On the Mac, Safari → Settings → Advanced → "Show features for web developers". On the iPhone, Safari → Advanced → Web Inspector ON. Connect by cable.
2. **Attach:** Open the **home-screen app** online. On the Mac, choose Develop → iPhone → *the web-app target* (not a Safari tab). The SW appears as its own target.
3. **Page console:**
   ```js
   location.href
   const r = await navigator.serviceWorker.getRegistration();
   ({ctrl: navigator.serviceWorker.controller?.scriptURL, active: r?.active?.state, waiting: !!r?.waiting, installing: !!r?.installing})
   await r.navigationPreload.getState()
   await caches.keys()            // serwist-precache-v2-… vs expense-reminders-v6
   const pc = await caches.open((await caches.keys()).find(k => k.includes('precache')));
   const keys = (await pc.keys()).map(q => q.url); keys.length; keys.filter(u => !u.includes('/_next/'))
   [...document.scripts].map(s => s.src).filter(Boolean)   // contains ?dpl= ?
   await navigator.storage.persisted(); await navigator.storage.estimate()
   ```
4. **SW target console:** look for `bad-precaching-response` or install errors.
5. **Airplane mode:** turn it on (the USB inspector keeps working), force-quit, relaunch, re-attach.
   - Network tab: is the document request *pending* or *served by the SW*?
   - Note what the screen shows: pure black or white means the document never arrived (H1/H2). The app's background with no content means the HTML loaded but JS didn't (H2a/H3).
6. **Network Link Conditioner "100% Loss"** (Settings → Developer), or Wi-Fi with no uplink: relaunch and compare with step 5. If only this case hangs, H1 is confirmed.
7. **On a stuck page:**
   - `document.querySelector('.app-hydrated-content')`
   - `performance.getEntriesByType('resource').filter(e => !e.responseStatus).map(e => e.name)`
   - Console errors that list chunk URLs.

---

## 3. Recommended fixes (ship 1 to 3 together)

### Fix 1. `src/pwa/sw.ts` (H1, H3, H6, H2a)
Add a pure `src/pwa/cache-policy.ts` (unit-testable):
```ts
export const LEGACY_CACHE_PREFIX = "expense-reminders-";
export const PER_BUILD_RUNTIME_CACHES = ["pages", "pages-rsc"];
export const isObsoleteCacheName = (n: string) =>
  n.startsWith(LEGACY_CACHE_PREFIX) || PER_BUILD_RUNTIME_CACHES.includes(n);
export function stripDeploymentQuery(href: string) { const u = new URL(href); u.searchParams.delete("dpl"); return u.href; }
```
In `sw.ts`:
```ts
import { disableNavigationPreload, /* existing */ } from "serwist";
import type { SerwistPlugin } from "serwist";

// Abort only if response headers don't arrive in time. AbortSignal.timeout would also cut slow chunk bodies.
const abortIfNoResponse = (ms: number): SerwistPlugin => ({
  requestWillFetch: async ({ request, state }) => {
    const c = new AbortController();
    if (state) state.timer = setTimeout(() => c.abort(), ms);
    return new Request(request, { signal: c.signal });
  },
  fetchDidSucceed: async ({ response, state }) => { clearTimeout(state?.timer as number); return response; },
  fetchDidFail: async ({ state }) => { clearTimeout(state?.timer as number); },
});
const ignoreDeploymentQuery: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => stripDeploymentQuery(request.url),
};
```
- Add `abortIfNoResponse(6000)` to **every** runtime strategy (`next-static`, `pages`, `app-assets`, `pages-rsc`, `same-origin`). Add `ignoreDeploymentQuery` to `next-static` and `app-assets`. Optionally use `new NetworkOnly({ networkTimeoutSeconds: 10 })` for `/api`.
- In the Serwist options:
  ```ts
  precacheOptions: { cleanupOutdatedCaches: true, ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^dpl$/], concurrency: 4 },
  navigationPreload: false,
  ```
- At top level:
  ```ts
  disableNavigationPreload(); // the flag persists on the registration; `false` alone doesn't clear it
  self.addEventListener("activate", (e) => e.waitUntil(
    caches.keys().then((ns) => Promise.all(ns.filter(isObsoleteCacheName).map((n) => caches.delete(n))))));
  ```
- Optional: a `message` handler `GET_OFFLINE_STATUS` that replies `{ expected: self.__SW_MANIFEST?.length ?? 0, cached: (await precache.keys()).length }`, for the Settings row in fix 4.
- **Why this works:** precached routes become truly cache-first and instant. Routes that aren't precached get the 3 s race, then abort at 6 s, then the `/` fallback. Nothing can hang.
- **Trade-off:** online launches show the cached build until the SW updates. Optional fix: on `controllerchange`, reload at the next visibility change.
- **First rollout on iOS:** the first update may need one force-quit to hand over from the SW that had preload enabled.

### Fix 2. `serwist.config.mjs`
```js
import { serwist, generateGlobPatterns } from "@serwist/next/config"; // generateGlobPatterns export confirmed (index.config.ts:132)
globPatterns: [...generateGlobPatterns(".next/"), ".next/static/media/**/*.{woff,woff2}"], // the prerendered *.html pattern is still appended
globIgnores: ["public/app-icon-1024.png"],  // or delete the file; it's unused
```
- Add `scripts/verify-sw.mjs` to `build` (`… && serwist build serwist.config.mjs && node scripts/verify-sw.mjs`). It fails the build if `public/sw.js` is missing, if `/`, `/money`, `/login`, `/expenses/new` or `/settings?from=money` are missing from the manifest, or if there are 0 `/_next/static/` entries.
- "Precache all routes" is already true for static routes. The only dynamic gap is `/expenses/[id]`, which is covered by fallback plus timeout.
- Optionally add `/^v$/` to the ignore list so the `?v=5` icons match the precache.

### Fix 3. Never render nothing forever (H4)
- **`use-expense-store.ts`:**
  - `ExpenseStoreProvider({ children, fallback })` renders `fallback` instead of `null`. This keeps the store free of UI imports.
  - `layout.tsx` passes `<AppBootShell />`.
- **New `AppBootShell`** (no hooks, server-rendered):
  - Built from `app-page app-page-safe`, `app-section-card` and `app-surface-muted` skeleton rows, with `aria-busy`.
  - Includes a `role="status"` "Cargando…".
  - Includes a help block that **CSS reveals after about 6 s** (`animation-delay`; reduced-motion respected). Without CSS it is visible straight away, which is the right failure mode. It says "Si no carga, abre la app con conexión una vez para prepararla sin conexión" and has a plain `<a href="/" class="app-button app-button-secondary">Reintentar</a>`, which works without JS.
  - Styles go in `globals.css` or `styles/app-shell.css` using `--app-*` tokens.
- **Optional diagnostic:** a `next/script` `beforeInteractive` inline listener (`error` in the capture phase plus `unhandledrejection`) that writes the failed asset URLs into a `[data-boot-diagnostics]` element (`suppressHydrationWarning`) inside the shell. The device then shows which chunk failed.
- **`use-store-persistence.ts`:**
  - Call `hydrateLocalSnapshot()` **before** `createClient()`, inside `try { … } finally { markHydrated(); }`.
  - Wrap `createClient()` in try/catch: on failure, `markError(…)` and treat the client as null.
  - Separate data-safety fix: add `readExpenseStoreSnapshot(): {store, status:'ok'|'missing'|'corrupt'}` in `local-store.ts` and skip `saveExpenseStore` when the status is `corrupt`.
- Add `src/app/global-error.tsx` (with its own `<html><body>`, importing `./globals.css`, with Reintentar and a link to `/`).

### Fix 4. Visibility (H2, H5)
- **`PwaRegister`:**
  - Log registration errors with `console.error` instead of swallowing them.
  - Call `registration.update()` on `visibilitychange` → visible, throttled to at most once a minute (iOS resumes apps without navigating).
  - Call `navigator.storage.persist?.()` after `serviceWorker.ready`.
- **Offline indicator:** a `src/shared/hooks/use-online-status.ts` hook (`useSyncExternalStore` on `online`/`offline`) and a small `OfflineBadge` (`app-chip app-chip-slate`, "Sin conexión") in the DashboardShell and Plan headers. Display only: `navigator.onLine` is unreliable on iOS.
- **Settings row "Uso sin conexión: Listo / Preparando / No disponible":**
  - `features/settings/lib/offline-readiness.ts` (pure function of `{hasController, activeState, expected, cached}`), `hooks/use-offline-readiness.ts`, and `components/rows/OfflineRow.tsx`.
  - i18n keys go in `i18n-messages.ts`.
  - This lets the owner check readiness without a Mac.
- Update the `docs/platform.md` "Service worker" section. Its current statement that navigations use NetworkFirst with a fallback to the shell is wrong for precached routes.

### Tests
- **`tests/service-worker.test.ts`:** assert `navigationPreload: false`, `disableNavigationPreload()`, `/^dpl$/`, the abort plugin on every runtime strategy, the obsolete-cache cleanup, and in the config the `globIgnores` icon entry and the woff2 pattern.
- **`src/pwa/cache-policy.test.ts`:**
  - `stripDeploymentQuery("…/x.js?dpl=a&v=1")` returns `"…/x.js?v=1"`.
  - `isObsoleteCacheName` returns true for `expense-reminders-v6` and `pages`, and false for `serwist-precache-v2-…` and `next-static`.
- **`use-expense-store.test.tsx`:** the fallback renders before hydration and the children after; hydration completes when `localStorage.getItem` throws and when `createClient` throws (mocked).
- **`local-store.test.ts`:** a corrupt value is not overwritten.
- **`offline-readiness.test.ts`.**
- **e2e:** keep S1 through S4 permanently (`npm run e2e:offline`, with `@dpl` tagged separately because of build time). After the fix, all `blackhole`, `update` and `dpl` cases must boot within 5 s on Chromium, and on WebKit wherever the SW runs.
- Run `npm run lint` and `npm test`.

---

## 4. Questions for the owner (in Spanish, ready to send; each one names the hypothesis it settles)
1. ¿En qué dispositivo falla? iPhone (versión de iOS) o Android, ¿app añadida a la pantalla de inicio o pestaña de Safari/Chrome? (decides H1 and H2)
2. ¿Cómo te quedas offline? Modo avión, datos apagados, cobertura mala o metro, o Wi-Fi sin internet. (decides H1)
3. ¿Qué ves exactamente: pantalla negra o blanca, el fondo de la app sin contenido, o un error de "no conectado"? ¿Cuánto esperaste? (separates "the document never arrived" from "JS didn't load")
4. ¿Ha funcionado offline alguna vez? ¿Falla solo al abrir en frío (tras cerrar la app) o también con la app abierta? ¿Solo después de un deploy? (decides H3 and the update path)
5. ¿Cuándo abriste la app por última vez con conexión, y la dejaste abierta unos segundos? ¿Añadiste el icono antes del 23 de agosto, y lo has borrado o vuelto a añadir desde entonces? (decides H2)
6. ¿En qué URL lo pruebas: dominio de producción, `*.vercel.app`, una preview, o `npm run dev` en local? (decides H5)
7. Vercel: ¿plan Hobby o Pro? ¿Skew Protection activado? ¿Build Command sobrescrito? ¿A qué rutas aplica la regla de rate limit del Firewall? ¿Attack Challenge Mode activo? ¿Me pasas el dominio de producción? (decides H3, H2b and H7)
8. ¿Tienes un Mac para conectar el iPhone con Safari Web Inspector? (makes the device checklist possible)
9. ¿Tienes activadas restricciones de contenido web en Tiempo de uso? (low priority)

**Sources:** [helprr#428](https://github.com/SaiBarathR/helprr/pull/428) · [openGym#274](https://github.com/DuarteSantos8/openGym/issues/274) · [WebKit 258196](https://bugs.webkit.org/show_bug.cgi?id=258196) · [WebKit 236483](https://bugs.webkit.org/show_bug.cgi?id=236483) · [playwright#2311](https://github.com/microsoft/playwright/issues/2311) · [playwright#42775](https://github.com/microsoft/playwright/issues/42775) · [Playwright SW docs (raw)](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/service-workers-js-python.md) · [room-tba#1219](https://github.com/uplbtools/room-tba/pull/1219) · Serwist 9.5.12, Next v16.3.2, vercel/vercel and adapter-vercel source (checked out locally during the analysis)

**Repo files to change:**
- `src/pwa/sw.ts`
- `serwist.config.mjs`
- `src/stores/app/use-expense-store.ts`
- `src/stores/app/use-store-persistence.ts`
- `src/data/persistence/local-store.ts`
- `src/app/layout.tsx`
- `src/app/providers/PwaRegister.tsx`
- `tests/e2e/offline.spec.ts`
- `tests/service-worker.test.ts`
- `playwright.config.ts`
- `docs/platform.md`
