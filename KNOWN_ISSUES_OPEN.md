# KNOWN ISSUES OPEN

These items are based on the current repo contents after the latest stabilization work.

## High Priority

### 1. Service worker updates still need live refresh verification

The shell asset list is now generated, but cache version bumps and reopened-PWA behavior still need live verification after frontend changes.

### 2. No live `index.json`

The repo still runs on `hubIndex.js`. Historical docs mention `index.json`, but that is still a future direction, not a current repo fact.

## Medium Priority

### 3. Recent Library/HUB stabilization still needs browser regression coverage

The code now separates Home roots, Library removal semantics, and HUB-to-local promotion more cleanly, but these flows should still be validated interactively across refreshes and PWA sessions.

### 4. Hard-list generation needs live verification across old stored data

New hard marks are now stored with stable signatures and can generate hard lists correctly. Older pre-change hard marks may still exist in storage and are not guaranteed to map cleanly into generated lists.

### 5. Mobile behavior still needs live phone verification

The narrow-screen CSS is now tighter and more touch-safe, but Home, Library, FC, WM, WP, and standalone PWA reopen behavior still need real device testing before production confidence is justified.
