# HUB SPEC

## Current HUB Files

- `hubIndex.js`
- `core/hubAdapter.js`
- `core/hubManager.js`
- `ui/accordion.js`
- `scripts/build_hub_index.py`

## Current HUB Responsibilities

- expose bundled language pairs
- expose bundled topic folders
- filter topic tree by selected game
- fetch bundled CSV files from `hub/`
- keep bundled HUB content separate from local editable content on Home
- support Library access to HUB lists without mutating bundled files

## Current Source Of Truth

Bundled metadata currently comes from `window.HUB_INDEX` in `hubIndex.js`.

There is no live `index.json` file in this repo.

`hubIndex.js` is generated from the physical `hub/` folders by `scripts/build_hub_index.py`.

## Current Bundled Structure

Physical hub layout:

- `hub/<language-pair>/<topic>/<file>.csv`

Generated registry shape:

- `language`
- `topic`
- `files`

## Home Rendering Rule

The Home accordion is intentionally split into two roots:

- `Choose a topic`
- `My lists`

Meaning:

- `Choose a topic` shows bundled HUB content
- `My lists` shows local editable content

Bundled content is not supposed to move into `My lists` until it becomes a real local editable copy.

## Library Integration Rule

The Library is broader than Home and may show:

- raw bundled HUB entries
- cached HUB entries that were started or opened
- local editable copies
- imported lists
- user-created lists

Library removal rules:

- deleting a bundled HUB entry from the Library removes it from the Library only
- it does not remove it from Home
- it does not remove it from `hub/`

## Source State Semantics

- `hub`: bundled file from `hub/`
- `hub-cache`: bundled file fetched and stored locally for Library availability
- `hub-copy`: edited former HUB file that now behaves as local editable content
- `local`: user-created list
- `import`: CSV-imported list

UI badge semantics:

- `HUB` -> `hub`, `hub-cache`
- `MINE` -> `hub-copy`, `local`, `import`

## Current Filtering Rule

- Topic `sentences` is sentence content:
  - available to `flashcards`
  - available to `wordmatch`
  - available to `wordpuzzle`

- Any other topic is standard pair content:
  - available to `flashcards`
  - available to `wordmatch`
  - not available to `wordpuzzle`

## Important Current Behavior

- Starting a HUB list from Home also creates a local cached record so it becomes editable through the Library later.
- Simply starting a HUB list does not yet make it part of the Home `My lists` root.
- The first real edit promotes the cached HUB record into a local editable list.

## Automation

`.github/workflows/rebuild-hub-index.yml` rebuilds `hubIndex.js` automatically on pushes that change `hub/`.
