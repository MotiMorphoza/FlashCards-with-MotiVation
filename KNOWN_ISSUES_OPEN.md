# KNOWN ISSUES OPEN

These items are based on the current repo contents after the latest stabilization work.

## High Priority

### 1. Service worker install list can still drift

`sw.js` still has a manual precache asset list. The runtime strategy is better now, but the install list is not generated from the real import graph.

### 2. No live `index.json`

The repo still runs on `hubIndex.js`. Historical docs mention `index.json`, but that is still a future direction, not a current repo fact.

## Medium Priority

### 3. Library row search rerenders on every keystroke

Library row search has no debounce and rerenders the editor immediately on each input event.

### 4. Recent Library/HUB stabilization still needs browser regression coverage

The code now separates Home roots, Library removal semantics, and HUB-to-local promotion more cleanly, but these flows should still be validated interactively across refreshes and PWA sessions.

### 5. Hard-list generation needs live verification across old stored data

New hard marks are now stored with stable signatures and can generate hard lists correctly. Older pre-change hard marks may still exist in storage and are not guaranteed to map cleanly into generated lists.

### 6. Legacy hidden-origin storage paths remain in code

The repo now uses separate hide semantics for bundled-tree visibility and Library-only visibility. The old hide API should be cleaned up carefully later, not aggressively removed without migration thought.
