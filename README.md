# ONE SOURCE

ONE SOURCE is a static browser app that unifies three language-learning modes behind one shell:

- Flash Cards
- Word Match
- Word Puzzle

The repo is plain HTML, CSS, and JavaScript. It is designed to stay GitHub Pages friendly and not depend on a product backend.

## Current Repo Reality

- Entry point: `index.html`
- Main app controller: `core/hubManager.js`
- Bundled content registry: `hubIndex.js`
- Generated app-shell cache manifest: `sw-assets.js`
- Shared data loader: `core/hubAdapter.js`
- Shared storage: `core/storage.js`
- Shared session logic: `core/engine.js`
- Games: `games/flashcards.js`, `games/wordmatch.js`, `games/wordpuzzle.js`
- App icons: `assets/icons/`
- Bundled hub content lives in `hub/`
- Local user content lives in browser `localStorage`

Important: this repo does **not** currently ship a live `index.json`. The app reads `window.HUB_INDEX` from `hubIndex.js`.

## How The App Works Today

1. The home screen lets the user choose a language pair and a game.
   - The language selector now unions bundled HUB pairs, local custom pairs, and legacy local-only `lang` values.
2. The home accordion renders as two roots:
   - `Choose a topic` for bundled HUB content
   - `My lists` for editable local content
3. Clicking a topic on Home now starts the selected game directly.
4. Starting a bundled HUB file fetches its CSV and also stores a local cached copy so it becomes available in the Library.
5. The first real edit to that cached HUB list promotes it into a local editable list (`MINE`).
6. Hard items are tracked across play sessions.
7. `My lists` can now auto-generate `Hard words` and `Hard sentences` when an item was answered wrong at least twice.
8. Games run through a shared `SessionEngine`.

## Bundled Hub Layout

Bundled hub content lives in this physical structure:

```text
hub/<language-pair>/<topic>/<file>.csv
```

The topic folder name may differ per language pair. Example:

```text
hub/he-en/Daily Use/Basic.csv
hub/he-pl/Na co dzień/Podstawy.csv
```

`hubIndex.js` is generated from that folder structure by `scripts/build_hub_index.py`.
The generated registry now stores `folders[language]` so the app can resolve localized folder names per language pair.

## Library Behavior

- The Library now focuses on lists the user actually touched locally.
- It shows cached HUB lists, edited HUB-derived lists, user-created lists, and imported lists.
- Custom language pairs can be created only through the `Create list` flow.
- Import can target an existing bundled or custom language pair, but import does not create a new pair.
- Every card in the Library now uses `Edit`.
- Library cards can be removed directly from the Library screen.
- Removing a HUB list from the Library now hides it from the Library only.
- Home still reflects the physical bundled HUB and does **not** remove that list from `Choose a topic`.
- Local lists can be deleted from the Library.
- The editor screen no longer owns list deletion.

## Source Status Model

Current source states in code:

- `hub`: bundled file from `hub/`
- `hub-cache`: a bundled file that was started or opened and cached locally for Library access
- `hub-copy`: a former HUB file that was actually edited and is now part of local editable content
- `local`: user-created list
- `import`: CSV-imported list

UI meaning:

- `HUB` badge: `hub` and `hub-cache`
- `MINE` badge: `hub-copy`, `local`, and `import`

## Custom Language Pairs

- Custom pairs are stored separately from `hubIndex.js`.
- The custom-pair registry key is `LLH_v4_local_language_pairs`.
- Each custom pair keeps a stable local `lang` id, while UI labels resolve from bundled pairs first, then the custom registry, then raw fallback.
- Creating a brand-new custom pair through `Create list` also creates a `sentences` system template named `Word Puzzle setup` when the first user topic is not `sentences`.
- That template list is visible, editable, and deletable, but it is never playable and does not contribute to sessions, accuracy, hard marks, or generated hard lists.

## Hard Lists

- A row becomes part of the hard lists after 2 wrong answers.
- Hard rows are aggregated across all lists for the same language pair.
- Non-sentence content becomes `Hard words`.
- Sentence content becomes `Hard sentences`.
- These lists are generated automatically under `My lists`.

## Content Rules In Code

- Topic `sentences` is available to Flash Cards, Word Match, and Word Puzzle.
- All other topics are available to Flash Cards and Word Match.
- Word Puzzle can use only the `sentences` topic.
- Rows are normalized to `{ id, source, target }`.
- Users can create their own topics from the Library UI.
- Duplicate list names are blocked within the same language pair and topic.
- System-template promotion happens only from row-save paths after the original template row is fully replaced by real non-empty content.

## Local Development

Open the project through HTTP, not `file://`.

```bash
node server.js
```

Then open `http://localhost:4173`.

To rebuild the bundled hub index locally:

```bash
python scripts/build_hub_index.py
```

To rebuild the generated service-worker asset manifest locally:

```bash
python scripts/build_sw_assets.py
```

## GitHub Automation

The repo includes:

- `.github/workflows/rebuild-hub-index.yml`
- `.github/workflows/rebuild-sw-assets.yml`

When you push changes under `hub/`, GitHub Actions:

1. scans the physical hub folders
2. rebuilds `hubIndex.js`
3. commits the updated index back to `main`

Normal content flow:

1. add a new topic folder under `hub/<language-pair>/`
2. add one or more `.csv` files
3. push to GitHub

After the workflow finishes, the new bundled content is reflected on the site.

Only language folders that contain at least one CSV file are included in the generated `hubIndex.js`.

Because this workflow writes a small follow-up commit to `main`, local Git should prefer rebase over merge when syncing:

```bash
git config pull.rebase true
git config branch.main.rebase true
git config rebase.autoStash true
```

## Current Gaps Still Confirmed

- `hubIndex.js` is still the live metadata source
- there is still no live `index.json`
- cache name bumps are still required when the shipped shell changes
- recent Library/HUB flows still need live browser and PWA regression coverage

## PWA Assets

- The app now ships a favicon SVG, a 32px PNG fallback, an Apple touch icon, and 192px/512px manifest icons under `assets/icons/`.
- `manifest.json` includes the current install icons.
- `index.html` now ships share-preview metadata for link unfurls, including Open Graph and Twitter tags plus a dedicated social card image at `assets/social/share-card.png`.
- `sw.js` now precaches the app shell from generated `sw-assets.js`, which is built from `index.html` and the current static import graph.

## Share Preview Metadata

- Link previews now use `index.html` metadata for title, description, and image.
- The current share card asset is `assets/social/share-card.png`.
- The metadata currently targets the default GitHub Pages deployment URL for this repo: `https://motimorphoza.github.io/One-Source/`.
- If the app later moves to a custom domain, update `og:url`, `og:image`, `twitter:image`, and the canonical link in `index.html`.

## Scope Note

`server.js` is only a local static file server for development. It is not a product backend.
