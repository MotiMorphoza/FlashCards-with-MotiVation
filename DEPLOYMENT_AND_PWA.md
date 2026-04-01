# DEPLOYMENT AND PWA

## Current Files

- `index.html`
- `manifest.json`
- `sw.js`
- `sw-assets.js`
- `server.js`
- `assets/social/share-card.png`
- `assets/icons/app-icon.svg`
- `assets/icons/favicon-32.png`
- `assets/icons/apple-touch-icon.png`
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`
- `.github/workflows/rebuild-hub-index.yml`
- `.github/workflows/rebuild-sw-assets.yml`

## Current Behavior

- `manifest.json` uses `./index.html` as `start_url`
- `index.html` links a favicon, PNG fallback, and Apple touch icon from `assets/icons/`
- `index.html` now includes Open Graph and Twitter share-preview metadata that points at the default GitHub Pages URL for this repo
- the share-preview image is `assets/social/share-card.png`
- the current default GitHub Pages URL for this repo is `https://motimorphoza.github.io/One-Source/`
- `index.html` now uses `viewport-fit=cover` and Apple standalone meta tags for safer mobile/PWA framing
- `manifest.json` now ships 192px and 512px app icons
- `core/hubManager.js` registers `./sw.js` with `updateViaCache: "none"`
- `sw.js` now consumes generated shell assets from `sw-assets.js`
- `server.js` serves the repo over HTTP on port `4173`
- the UI no longer shows a local-server warning banner

## Current Service Worker Strategy

`sw.js` currently uses:

- install-time precache from generated `sw-assets.js`
- network-first for:
  - app shell requests (`html`, `css`, `js`, `json`)
  - `hubIndex.js`
  - files under `hub/`
- cache fallback if network fails

Current cache name:

- `llh-core-v8`

## Good Current Signs

- app asset paths are relative
- service worker registration is relative
- manifest path is relative
- hub file fetches use relative paths

## Current Risks

1. Cache name bumps are still required when shipped assets change.
2. The app currently depends on `hubIndex.js`, so metadata and content deployment must stay in sync.
3. After major frontend changes, a hard refresh or reopening the PWA may still be needed to pick up the new shell.
4. If the deployed site later uses a custom domain, the share-preview URL tags in `index.html` must be updated away from the default GitHub Pages URL.

## Practical Rule

Always test through HTTP:

```bash
node server.js
```

## GitHub Deployment Rule

Bundled content should be updated by changing `hub/` and letting the GitHub Action regenerate `hubIndex.js`.

App-shell assets should be updated by changing the frontend source files and letting the GitHub Action regenerate `sw-assets.js`.

## Local Git Sync Rule

The hub-index workflow writes a follow-up commit to `main` after `hub/` changes. To avoid local merge commits when syncing, this repo should use rebase-based pulls:

```bash
git config pull.rebase true
git config branch.main.rebase true
git config rebase.autoStash true
```
