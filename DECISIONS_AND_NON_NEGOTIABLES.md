# DECISIONS AND NON-NEGOTIABLES

## Confirmed From The Repo

1. The app is static-first.
2. The repo uses plain browser JavaScript, not a framework.
3. `server.js` is a local static dev server, not a product backend.
4. Relative paths are used throughout the app shell and service worker setup.
5. The current bundled HUB source is `hubIndex.js`.
6. Local editable copies of HUB content are part of the current behavior.
7. Home intentionally separates bundled HUB content from local editable content.
8. Word Puzzle is the only sentence-mode game.
9. Flash Cards and Word Match share standard non-sentence topic content.

## Important Clarification

`index.json` is not a current repo fact. It is a future design target that older docs mentioned. Do not build changes that assume it already exists.

## Verified Guardrails For Future Work

- do not break the Home -> HUB -> game flow
- do not break the Home split between `Choose a topic` and `My lists`
- do not break Library editing or Library-only removal semantics
- do not break local storage compatibility without a migration plan
- do not replace the static app with a backend architecture
- do not hide current repo issues behind vague future abstractions
