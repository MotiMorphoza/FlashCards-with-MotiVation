# TEST PLAN

## Home And HUB

- select each language pair
- select each game
- verify the Home accordion appears
- verify the topic chooser is compact and the start button sits below it
- leave Home and return to it, then verify the accordion is collapsed again
- select a topic under `My lists` and verify the `My lists` accordion stays open after selection
- verify Home shows:
  - `Choose a topic` for bundled HUB content
  - `My lists` for local editable content
- verify the shared top-bar `Home` button appears on non-editor screens only
- verify `Sound` and `Speech` appear only on the game screen
- verify sentence content appears for Word Puzzle only
- verify non-sentence topics appear for Flash Cards and Word Match

## Library

- create a local list
- import a valid CSV
- verify the new list appears in the Library
- verify a newly created list shows `language | topic | list name` in the expected order
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
- verify row/edit/rename modal actions keep `Save` on the left and `Cancel` on the right
- verify the Add-row modal uses `Save` and keeps `Save` / `Cancel` at the same width
- verify the Library screen opens on mobile without horizontal side-to-side scrolling
- verify the Library mobile fix does not collapse or overlap its internal sections while removing horizontal scrolling
- verify Firefox mobile does not show side-to-side scrolling on Home, Library, Editor, Stats, Contact, or Games
- verify Word Match no longer shows the extra instruction sentence above the board
- verify the Rename modal shows no helper sentence under the title
- verify the mobile top-bar buttons stay aligned and within the viewport
- verify Library card game buttons and `Edit` / `Delete` align cleanly without protruding sideways
- verify editor action groups (`Add row / Rename`, `Export / Back`) align as equal-width pairs on mobile
- verify Flash Cards mobile actions render as two equal-width button pairs instead of one long vertical column
- verify `Edit` buttons in Library cards and row actions use the blue action style
- verify the Flash Cards `I knew it` button uses the lavender action color
- verify Flash Cards desktop actions also render as two equal-width rectangular pairs
- verify mobile end-of-game stats render as two-column paired blocks instead of a single long column
- verify Flash Cards starts from the first row in file order until the user presses `Shuffle`
- verify Word Puzzle sentences start from the first row in file order
- verify selected topics use the same wine-purple accent family as the highlighted list-name path segment
- verify the `Choose a topic` root header uses the new deep vivid purple accent
- verify choosing a game leaves both accordion roots closed by default until the user opens one
- verify switching between games also clears any previously open accordion root instead of reopening HUB automatically
- start a `hub-cache` list from Library in Word Match and verify it no longer fails with `topicMeta is null`
- verify Word Puzzle no longer shows the extra instruction sentence and that the translation text is larger
- verify the Contact title stays on two lines: `Hebrew` and `With Moti Vation`
- verify localized physical topic folders still resolve correctly, for example `he-en/Daily Use` and `he-pl/Na co dzień`
- verify only language pairs with real CSV content appear in the Home language selector
- verify `ar-he` appears as `Arabic -> Hebrew` and loads Arabic folder/file names correctly from the localized physical HUB paths
- verify `ar-he` rows open in games as `Arabic -> Hebrew` data rather than the older copied Polish content

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
- verify the Flash Cards `Another round` button label is correct
- verify Flash Cards action buttons use distinct colors
- verify desktop game screens fit the viewport without unnecessary page scrolling
- verify long game content stays reachable and does not get visually clipped on desktop
- restart a completed session
- exit back to Home

## Mobile

- open Home on a narrow phone viewport and verify the shell keeps useful width
- verify Home button rows stack cleanly without clipped labels
- verify mobile buttons shrink to fit their text instead of keeping oversized fixed widths
- verify nearby stacked button groups use a consistent local width instead of mismatched button lengths
- verify the shared top-bar puts `Home` above `Sound` and `Speech` when one row is too tight
- verify Home / Statistics / Contact stay on one row on phone
- verify the three Home shortcut buttons share equal width and together use most of the row
- verify Library create controls fill the width cleanly and do not overflow
- verify `Create list` and `Import list` stay on one row on phone
- verify Library action buttons stack into comfortable tap targets
- verify list game buttons stay on one row on phone
- verify each Library list card shows game buttons on one row and `Edit` / `Delete` on the row below
- verify the mobile game / edit / delete buttons on Library list cards stay the same size and feel slightly larger without affecting other buttons
- verify the Library editor uses `Export` and `Back` instead of `Export CSV` and `Back to library`
- verify nearby button groups in the Library editor and list cards keep a uniform size within each group
- verify the path order ends with the highlighted list name instead of the topic name
- verify the final visible path segment is the only highlighted segment in both Library cards and the editor path
- verify mixed LTR/RTL paths (`he-en | topic | list name`) keep the visible order stable and leave the highlight on the final segment
- verify the middle segment comes from `topicName` and the final highlighted segment comes from the stored list `name`
- verify row-level `Edit` / `Delete` buttons stay on one row on phone
- verify row-level `Edit` / `Delete` buttons use the same size and feel slightly larger
- verify each library row shows source and target on one line with a dash between them
- verify the editor modal flows stay usable above the mobile keyboard
- verify modal action buttons no longer stretch to full width on phone
- verify Add row / Rename stay on one row in the editor on phone
- verify list row text is much larger in the editor on phone
- verify Flash Cards text stays readable on short and long items
- verify Word Match keeps usable tap targets and remains in two columns on phone
- verify Word Match leaves a clearer visual gap between the instruction line and the board
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
- verify a mobile refresh does not briefly reveal a stale shell before the current UI appears

## Statistics

- verify the top stat tiles show `Sessions`, `Study time`, and `Accuracy`
- verify the three top stat tiles stay on one row on phone
- verify the `Hard lists` section updates correctly
