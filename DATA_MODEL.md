# DATA MODEL

## Current Normalized Row Shape

Rows are normalized to:

```js
{
  id: "string",
  source: "string",
  target: "string"
}
```

This shape is produced by:

- `utils/csv.js`
- `core/storage.js`

## CSV Parsing Today

The parser now:

- supports quoted values
- skips blank lines
- skips known header rows
- requires exactly two columns
- rejects malformed non-empty rows
- throws validation errors for unclosed quotes or missing cells

## Bundled HUB Metadata Shape

The live bundled registry is `window.HUB_INDEX` from `hubIndex.js`.

Physical source layout:

```text
hub/<language-pair>/<topic>/<file>.csv
```

Current generated shape:

```js
{
  version,
  rootTitle,
  languages: [{ id, title }],
  topics: [{ id, title }],
  entries: [
    {
      topic,
      folder,
      files: {
        "lang-pair": ["file.csv"]
      }
    }
  ]
}
```

## Local Library Topic Shape

`core/storage.js` sanitizes topics to:

```js
{
  id,
  name,
  fileName,
  path,
  lang,
  topicName,
  source,
  category,
  allowedGames,
  rows,
  createdAt,
  updatedAt,
  originPath,
  originMeta
}
```

## Source Values In Use

Current `source` values:

- `hub`
- `hub-cache`
- `hub-copy`
- `local`
- `import`
- `hard-list`

Meaning:

- `hub`: bundled only
- `hub-cache`: bundled file cached locally for Library access
- `hub-copy`: edited HUB-derived local list
- `local`: user-created local list
- `import`: imported local list
- `hard-list`: generated virtual list based on accumulated hard marks

## Category Rules In Code

- topic `sentences` -> `flashcards`, `wordmatch`, `wordpuzzle`
- any other topic -> `flashcards`, `wordmatch`

## Hidden Origin Keys

Current storage also tracks hidden bundled origins:

- `LLH_v4_hidden_hub_origins`
- `LLH_v4_hidden_library_hub_origins`

These are used for different UI scopes:

- bundled tree visibility
- Library-only visibility

## Hard Item Encoding

Hard marks are now recorded with a stable encoded signature based on:

- language pair
- category
- source text
- target text

That allows the app to generate stable hard lists even for bundled HUB content.

## Important Compatibility Note

The current bundled hub behaves as `language -> topic -> files`, while still allowing legacy local records with old `branch/group` fields to migrate forward through `core/storage.js`.
