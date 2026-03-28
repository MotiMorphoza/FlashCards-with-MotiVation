# AGENTS.md

This file is for coding agents working in the ONE SOURCE repo.

## Mission

Preserve the working static app while improving correctness and clarity.

Do not redesign the project as if it were a greenfield app.

## Current Repo Facts

- The app entry point is `index.html`.
- The app shell is controlled by `core/hubManager.js`.
- The current bundled hub registry is `hubIndex.js`.
- There is no live `index.json` in this repo.
- Hub content files live under `hub/`.
- Local user lists live in `localStorage` through `core/storage.js`.
- The three games are:
  - `games/flashcards.js`
  - `games/wordmatch.js`
  - `games/wordpuzzle.js`

## Hard Rules

1. Do not add a product backend.
2. Do not add frameworks unless explicitly requested.
3. Keep the app static-host friendly.
4. Preserve the shared HUB flow.
5. Patch in place before proposing a deep refactor.
6. Do not assume docs are correct if code disagrees.

## Current Intentional Structure

- One app shell
- One bundled HUB root on Home: `Choose a topic`
- One local root on Home: `My lists`
- One Library management screen for both bundled and local list records
- One shared storage namespace prefix: `LLH_v4_*`
- One shared session engine

## Current Source States

- `hub`
- `hub-cache`
- `hub-copy`
- `local`
- `import`

Meaning:

- starting a HUB file can create `hub-cache`
- editing that cached HUB file promotes it to `hub-copy`
- `hub-copy`, `local`, and `import` behave as local editable content

## Current Known Risks

- no live `index.json`
- service worker precache list is manual
- Library row search has no debounce
- recent Library/HUB state fixes still need live regression coverage
- legacy hide-origin storage APIs still exist for cleanup

## What To Verify Before Editing

1. Whether the change touches Home, Library, Library Editor, or a game runtime
2. Whether the change affects bundled HUB content, local Library content, or both
3. Whether the affected text reaches the DOM through `innerHTML`
4. Whether the change impacts GitHub Pages style relative paths
5. Whether the storage shape in `core/storage.js` must stay backward compatible
6. Whether the change touches the `hub -> hub-cache -> hub-copy` lifecycle

## Preferred Work Style

- inspect the real file first
- keep behavior stable
- use existing shared utilities when possible
- call out dead code and drift explicitly
- separate current fact from future target

## Important Accuracy Note

Historical docs in this repo previously described goals such as `index.json` and wider v4 unification. Treat those as design direction only when the current code does not already implement them.
