# WM DETAILS

## File

- `games/wordmatch.js`

## Current Runtime

Word Match:

- shuffles the incoming rows
- shows up to 6 active pairs at a time
- uses left/right card selection
- records correct and wrong attempts through `SessionEngine`
- refills the board from a queue until all pairs are cleared
- keeps the `Home` action in the header metrics row for faster return on smaller screens
- keeps the left/right board in two columns on phone instead of collapsing into one long stack

## Shared Dependencies

- `core/engine.js`
- `core/audio.js`
- `utils/helpers.js`
- `utils/text.js`

## Current Risks

- live mobile tap behavior still needs browser/device verification

## Behavioral Note

Cleanup is simple and mostly adequate. The game clears pending timeouts on destroy.
