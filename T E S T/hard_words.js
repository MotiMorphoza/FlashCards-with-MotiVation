const HardWords = {
  add(word, translation, game) {
    const key = `${word}||${translation}`;
    const hard = this.getAll();
    hard[key] = {
      count: (hard[key]?.count || 0) + 1,
      games: [...new Set([...(hard[key]?.games || []), game])]
    };
    localStorage.setItem('hard_words_global', JSON.stringify(hard));
  },

  getAll() {
    return JSON.parse(localStorage.getItem('hard_words_global') || '{}');
  }
};
