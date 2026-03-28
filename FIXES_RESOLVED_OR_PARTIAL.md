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

### Home navigation is now centralized in the top bar

The shell now uses one shared `Home` button near `Sound` and `Speech` instead of repeating `Home` buttons on most screens. The Library editor remains the one screen that stays library-scoped, and `Sound` / `Speech` are now shown only on game screens.

### The start button now sits below the accordion

Home no longer keeps the start action beside the topic chooser.

### Returning to Home now collapses the topic accordion again

Coming back to the Home screen now resets the accordion to a collapsed state instead of keeping it open from the previous visit.

### Mobile buttons now shrink more closely to their labels

On narrow screens, shared action buttons and top-bar controls now prefer content width instead of stretching like full-width bars.

### Nearby mobile button groups now keep a more uniform width

Stacked button groups on narrow screens now align to the widest label inside each local group instead of looking uneven or stretching to the full shell width.

### Starting a HUB file now makes it available in the Library

Playing a bundled HUB file creates a local cached record so the user can later edit it from the Library.

### The Library now shows touched local content instead of the full bundled HUB

The Library list view now focuses on cached, edited, created, and imported lists rather than every bundled HUB file across all languages.

### Editing a cached HUB list promotes it into local editable content

The code now distinguishes between a cached HUB list and a real local edited copy.

### Library cards now support direct deletion

Users no longer depend on the editor screen to remove whole lists.

### Bundled HUB lists can be removed from the Library only

Removing a bundled HUB list from the Library does not remove it from Home or from `hub/`.

### Legacy bundled-hide state no longer suppresses Home HUB content

Older hidden-origin entries are now migrated into Library-only hide state, and the Home accordion no longer filters bundled HUB files through that legacy key.

### Rename is in-place in current storage code

`Storage.renameLibraryTopic()` updates an existing topic object by id instead of creating a new one.

### Topic titles are no longer interpolated directly into game HTML

Game headers now render title text through DOM assignment instead of direct template interpolation.

### Deleting the last row deletes the topic object

Removing the final row from a local list removes the topic from storage and returns the editor to the Library view.

### CSV parsing is stricter

Malformed rows now raise explicit validation errors instead of being silently accepted.

### CSV export is safer for spreadsheet apps

Exported CSV files now include a UTF-8 BOM so non-Latin text is less likely to break when opened in Excel on Windows.

### Service worker now prefers fresh app shell and HUB content

`sw.js` uses network-first for shell files and bundled HUB assets, which reduces stale-shell behavior.

### Service-worker shell assets are now generated from the real frontend graph

`sw-assets.js` is now rebuilt from `index.html`, the static module imports, and the manifest icon list instead of being maintained by hand inside `sw.js`.

### Service-worker registration now checks updates more aggressively

The app now registers `sw.js` with `updateViaCache: "none"` and asks the registration to check for updates on load.

### Desktop game shells are now less likely to clip controls

The game screen uses a denser desktop layout and no longer hard-clips overflowing game content.

### Local storage write failures are surfaced more clearly

Library and HUB-cache flows now surface local save failures instead of silently acting as if the change definitely persisted.

### Expendable HUB cache can now be pruned before local saves fail

When the library collection runs out of browser storage, the app now tries to evict older `hub-cache` entries before giving up on saving editable local data.

### Topic-scoped persistence is more stable across HUB edits

Topic-scoped sessions and best times now prefer bundled origin identity when available, which reduces split records between a HUB file and its edited local copy.

### Library editor search is less noisy

The editor search now uses a short debounce, and the create-form inputs no longer trigger list rerenders on each keystroke.

### Library editing no longer depends on native browser dialogs

The editor now uses in-app modal dialogs for add, edit, rename, alert, and confirm flows, which is a better fit for PWA and mobile usage.

### Editor modals now use a consistent action order

Add-row, edit-row, and rename flows now keep `Save` on the left and `Cancel` on the right as a shared modal standard.

### Global mobile layout is now tighter and more touch-safe

The shell now uses smaller side margins on narrow screens, form controls expand to safe widths, button rows stack more predictably, and core tap targets such as topic buttons and puzzle tokens keep a safer minimum height.

### The shared top bar now stacks `Home` above `Sound` and `Speech` on narrow screens

If the top controls cannot sit comfortably on one row, the `Home` button moves to a centered row above the other two instead of forcing awkward wrapping.

### Home action buttons and key mobile action rows are tighter again

On narrow screens, the Home shortcuts, list creation actions, list editor actions, and stats summary row now stay denser and closer to single-row layouts where requested instead of expanding into oversized stacked controls.

### Library cards now separate game actions from list management more clearly

Library topic cards now place their game buttons on one row and keep `Edit` / `Delete` together on a separate row beneath them, which is easier to scan on phone screens.

### The Home game cards now show titles only

The game chooser no longer shows the old descriptive subtitles under each game title, while preserving the card footprint and giving the game names a larger font.

### Word Match and Word Puzzle mobile wrapping is less fragile

Word Match now keeps its two-column structure longer before collapsing, and long match/token text can wrap instead of forcing awkward overflow.

### Word Match no longer collapses into one long column on phone

The mobile CSS now preserves the left/right board layout instead of forcing the entire match board into a single vertical stack.

### Word Match wrong attempts now keep the real pair identity more reliably

The mismatch path now carries the underlying pair object forward, which reduces fallback timestamp-only hard-mark records.

### Hard lists can now be generated from real mistake data

Wrong answers are now stored with stable row signatures, and Home can generate `Hard words` and `Hard sentences` under `My lists` once an item reaches 2 mistakes.

## Partially Verified

### Library and editor state drift was reduced

The Library no longer reuses the create-form inputs as implicit list filters. This fixed several stale-view problems in code, but still deserves live browser regression testing.

## Not Marked Resolved Here

Do not treat the following as resolved from this file:

- live `index.json`
