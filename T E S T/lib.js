// lib.js - Shared utilities
const GameLib = {
  // === CSV ===
  parseCSV(text) {
    // הקוד המשותף של parseCsvLine
  },

  // === Audio ===
  audio: {
    ctx: null,
    enabled: true,
    init() { /* ... */ },
    play(type) { /* ... */ }
  },

  // === Storage ===
  storage: {
    get(key, fallback) { /* ... */ },
    set(key, value) { /* ... */ },
    getHardWords() { /* ... */ },
    addHardWord(word) { /* ... */ }
  },

  // === UI ===
  ui: {
    buildAccordion(hubIndex, lang, category) { /* ... */ },
    showScreen(id) { /* ... */ },
    shuffle(arr) { /* ... */ },
    isRTL(text) { /* ... */ }
  },

  // === Hub Interface ===
  hub: {
    loadFile(path) { /* ... */ },
    getAvailableFiles(lang, category) { /* ... */ }
  }
};
