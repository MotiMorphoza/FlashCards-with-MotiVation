# TEST PLAN

## Home And HUB

- select each language pair
- select each game
- verify the Home accordion appears
- verify the topic chooser row is compact and the start button sits to the right on desktop
- verify Home shows:
  - `Choose a topic` for bundled HUB content
  - `My lists` for local editable content
- verify sentence content appears for Word Puzzle only
- verify non-sentence topics appear for Flash Cards and Word Match

## Library

- create a local list
- import a valid CSV
- verify the new list appears in the Library
- verify the Library list section title is `Lists`
- start a bundled HUB list from Home and verify it appears in the Library with `HUB`
- open that cached HUB list and make a real edit
- verify it becomes `MINE`
- delete a local list from the Library card
- remove a bundled HUB list from the Library card and verify it still exists on Home
- rename a list
- delete rows until empty and verify topic deletion behavior
- export a list
- verify the editor has a top `Back to library` button near `Export CSV`
- search rows

## Hard Lists

- answer the same word wrong twice in Flash Cards or Word Match
- verify `Hard words` appears under `My lists`
- answer the same sentence wrong twice in Word Puzzle
- verify `Hard sentences` appears under `My lists`
- verify the generated hard lists start normally in the relevant games
- verify the Statistics screen updates both `Hard marks` and `Hard list items`

## Games

- start each game from bundled HUB content
- start each game from Library content
- verify the Flash Cards word frame stays compact for short items and expands naturally for long sentences
- verify the Flash Cards shuffle button label is `Shuffle`
- verify desktop game screens fit the viewport without unnecessary page scrolling
- restart a completed session
- exit back to Home

## Security

- import a topic name containing HTML-like text
- verify topic name does not execute when shown in a game header
- import malformed CSV rows and verify errors

## PWA And Deployment

- run via `node server.js`
- verify service worker registration
- hard refresh after asset changes
- verify relative paths still resolve
- verify a new `hub/` file appears after the GitHub Action rebuilds `hubIndex.js`

## Statistics

- verify the `Library` stat shows only the file count
- verify `Hard marks` and `Hard list items` both update correctly
