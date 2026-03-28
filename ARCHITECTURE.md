# ARCHITECTURE

## Overview

ONE SOURCE is a single-page static application with one shell and three game modules.

```text
index.html
  -> core/hubManager.js
    -> core/hubAdapter.js
    -> core/storage.js
    -> core/engine.js
    -> games/*
    -> ui/*
    -> utils/*
```

## Main Layers

### 1. Shell

- `index.html`
- `styles.css`
- `core/hubManager.js`
- `core/router.js`

The shell owns screen switching, home state, library state, imports, list editing, stats, and game launch.

### 2. Bundled HUB

- `hub/`
- `hubIndex.js`
- `scripts/build_hub_index.py`
- `core/hubAdapter.js`

The bundled content registry is currently `window.HUB_INDEX`, not `index.json`.

Physical layout:

```text
hub/<language-pair>/<topic>/<file>.csv
```

### 3. Local Library

- `core/storage.js`
- `ui/library.js`

The Library is a unified management view over:

- bundled HUB lists
- cached HUB lists
- edited HUB-derived lists
- user-created lists
- imported CSV lists

### 4. Shared Runtime

- `core/engine.js`
- `core/audio.js`
- `core/speech.js`
- `core/eventBus.js`

Games use a common session engine for timing, correctness, hard-item marking, and session persistence.

### 5. Game Modules

- `games/flashcards.js`
- `games/wordmatch.js`
- `games/wordpuzzle.js`

All games are launched through the same interface:

```js
game.init(container, context, engine)
```

## Current Screen Model

### Home

Home renders two separate accordion roots:

- `Choose a topic`: bundled HUB content only
- `My lists`: local editable content only

This separation is intentional. Bundled hub content is no longer visually mixed into local editable lists on the home screen.

### Library

The Library is broader than the home accordion. It shows:

- bundled HUB lists
- locally cached HUB lists
- local editable lists
- imported lists

The Library is where editing and removal are managed.

### Library Editor

The editor works on stored local topic objects from `core/storage.js`.

Bundled HUB rows are loaded and stored locally before editing. The editor no longer owns full-list deletion.

## Current Data Flow

1. User picks a language pair.
2. User picks a game.
3. `HubManager` asks `HubAdapter` for the home tree.
4. Home receives:
   - bundled HUB entries for `Choose a topic`
   - local editable entries for `My lists`
5. Starting a HUB list fetches CSV data from `hub/` and also creates a local cached record for the Library.
6. Editing that cached record promotes it into a local editable record.
7. Games receive normalized data and a shared `SessionEngine`.

## Current Source Lifecycle

```text
hub
  -> hub-cache
  -> hub-copy
```

Meaning:

- `hub`: bundled file only
- `hub-cache`: bundled file was started or opened and is now available in Library
- `hub-copy`: that cached file was actually edited and is now part of local editable content

Other local sources:

- `local`
- `import`

## Storage Notes

Storage is versioned under the `LLH_v4_*` namespace.

There are currently two separate hide concepts:

- hide a bundled HUB origin from the home/library merged tree
- hide a bundled HUB origin from the Library only

## What Is Already Unified

- app shell
- game launch path
- session timing and stats
- local storage namespace
- audio and speech helpers
- bundled HUB physical shape: `language -> topic -> files`

## What Is Still Not Fully Unified

- live metadata source is still `hubIndex.js`, not `index.json`
- service worker precache list is still manual
- Library row search still has no debounce
- some legacy storage hide APIs remain in code for backward compatibility and cleanup
