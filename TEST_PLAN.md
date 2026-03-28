# TEST PLAN

## Home And HUB

- select each language pair
- select each game
- verify the Home accordion appears
- verify the topic chooser is compact and the start button sits below it
- verify Home shows:
  - `Choose a topic` for bundled HUB content
  - `My lists` for local editable content
- verify the shared top-bar `Home` button appears on non-editor screens only
- verify sentence content appears for Word Puzzle only
- verify non-sentence topics appear for Flash Cards and Word Match

## Library

- create a local list
- import a valid CSV
- verify the new list appears in the Library
- verify the Library list view shows only touched local lists, not the entire bundled HUB
- verify the Library list section title is `Lists`
- start a bundled HUB list from Home and verify it appears in the Library with `HUB`
- open that cached HUB list and make a real edit
- verify it becomes `MINE`
- verify quota / storage failure paths surface a visible error instead of silently failing
- fill storage pressure with old cached HUB topics and verify saving a real local edit can evict expendable `hub-cache` first
- delete a local list from the Library card
- remove a bundled HUB list from the Library card and verify it still exists on Home
- seed legacy `LLH_v4_hidden_hub_origins` data, reload, and verify the list is hidden only from Library while still present on Home
- rename a list
- delete rows until empty and verify topic deletion behavior
- export a list
- open an exported CSV in Excel and verify Hebrew / Arabic text stays readable
- verify the editor has a top `Back to library` button near `Export CSV`
- search rows
- verify add/edit/rename/delete flows use in-app modal dialogs instead of browser-native prompts

## Hard Lists

- answer the same word wrong twice in Flash Cards or Word Match
- verify `Hard words` appears under `My lists`
- answer the same sentence wrong twice in Word Puzzle
- verify `Hard sentences` appears under `My lists`
- verify the generated hard lists start normally in the relevant games
- verify the Statistics screen updates the `Hard lists` breakdown

## Games

- start each game from bundled HUB content
- start each game from Library content
- start a HUB list, edit it into `MINE`, and verify best-time continuity still behaves as one topic identity
- verify the Flash Cards word frame stays compact for short items and expands naturally for long sentences
- verify the Flash Cards shuffle button label is `Shuffle`
- verify Flash Cards action buttons use distinct colors
- verify desktop game screens fit the viewport without unnecessary page scrolling
- verify long game content stays reachable and does not get visually clipped on desktop
- restart a completed session
- exit back to Home

## Mobile

- open Home on a narrow phone viewport and verify the shell keeps useful width
- verify Home button rows stack cleanly without clipped labels
- verify Library create controls fill the width cleanly and do not overflow
- verify Library action buttons stack into comfortable tap targets
- verify the editor modal flows stay usable above the mobile keyboard
- verify Flash Cards text stays readable on short and long items
- verify Word Match keeps usable tap targets and remains in two columns on phone
- verify Word Puzzle tokens wrap cleanly for long sentences without forcing horizontal scrolling
- verify reopening the installed PWA on mobile still picks up the current shell after an update
- verify iPhone-style safe areas do not crop the top or bottom UI when opened as a standalone app

## Security

- import a topic name containing HTML-like text
- verify topic name does not execute when shown in a game header
- import malformed CSV rows and verify errors

## PWA And Deployment

- run via `node server.js`
- verify service worker registration
- verify the registration requests updates without relying on HTTP cache reuse
- hard refresh after asset changes
- verify the browser favicon resolves
- verify Apple touch icon / installed app icon use the new asset set
- verify relative paths still resolve
- verify `sw-assets.js` contains the current shell files after frontend changes
- verify a new `hub/` file appears after the GitHub Action rebuilds `hubIndex.js`

## Statistics

- verify the top stat tiles show `Sessions`, `Study time`, and `Accuracy`
- verify the `Hard lists` section updates correctly
