# DEPLOYMENT AND PWA

## Current Files

- `index.html`
- `manifest.json`
- `sw.js`
- `server.js`
- `.github/workflows/rebuild-hub-index.yml`

## Current Behavior

- `manifest.json` uses `./index.html` as `start_url`
- `core/hubManager.js` registers `./sw.js`
- `server.js` serves the repo over HTTP on port `4173`
- the UI no longer shows a local-server warning banner

## Current Service Worker Strategy

`sw.js` currently uses:

- install-time precache for a manual asset list
- network-first for:
  - app shell requests (`html`, `css`, `js`, `json`)
  - `hubIndex.js`
  - files under `hub/`
- cache fallback if network fails

Current cache name:

- `llh-core-v5`

## Good Current Signs

- app asset paths are relative
- service worker registration is relative
- manifest path is relative
- hub file fetches use relative paths

## Current Risks

1. The service worker install list is still manual and can drift from the actual import graph.
2. Cache name bumps are still required when shipped assets change.
3. The app currently depends on `hubIndex.js`, so metadata and content deployment must stay in sync.
4. After major frontend changes, a hard refresh or reopening the PWA may still be needed to pick up the new shell.

## Practical Rule

Always test through HTTP:

```bash
node server.js
```

## GitHub Deployment Rule

Bundled content should be updated by changing `hub/` and letting the GitHub Action regenerate `hubIndex.js`.
