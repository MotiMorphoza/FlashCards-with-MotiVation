# FIXES RESOLVED OR PARTIAL

This file lists issues that are already supported by the current repo structure.

## Verified Or Largely Verified

### Shared session runtime exists

`core/engine.js` is real and used by all three games.

### Shared storage namespace exists

`core/storage.js` uses the `LLH_v4_*` namespace pattern.

### Bundled HUB shape is now `language -> topic -> files`

The physical `hub/` layout and generated `hubIndex.js` match that simplified topic model.

### Home now separates bundled HUB and local editable content

Home renders bundled HUB content under `Choose a topic` and local editable content under `My lists`.

### Starting a HUB file now makes it available in the Library

Playing a bundled HUB file creates a local cached record so the user can later edit it from the Library.

### Editing a cached HUB list promotes it into local editable content

The code now distinguishes between a cached HUB list and a real local edited copy.

### Library cards now support direct deletion

Users no longer depend on the editor screen to remove whole lists.

### Bundled HUB lists can be removed from the Library only

Removing a bundled HUB list from the Library does not remove it from Home or from `hub/`.

### Rename is in-place in current storage code

`Storage.renameLibraryTopic()` updates an existing topic object by id instead of creating a new one.

### Topic titles are no longer interpolated directly into game HTML

Game headers now render title text through DOM assignment instead of direct template interpolation.

### Deleting the last row deletes the topic object

Removing the final row from a local list removes the topic from storage and returns the editor to the Library view.

### CSV parsing is stricter

Malformed rows now raise explicit validation errors instead of being silently accepted.

### Service worker now prefers fresh app shell and HUB content

`sw.js` uses network-first for shell files and bundled HUB assets, which reduces stale-shell behavior.

## Partially Verified

### Library and editor state drift was reduced

The Library no longer reuses the create-form inputs as implicit list filters. This fixed several stale-view problems in code, but still deserves live browser regression testing.

## Not Marked Resolved Here

Do not treat the following as resolved from this file:

- live `index.json`
- search debounce
- manual service worker asset graph management
