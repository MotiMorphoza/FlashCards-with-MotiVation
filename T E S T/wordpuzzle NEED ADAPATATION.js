// wordpuzzle.js
const FlashCards = {
  session: [],
  current: 0,

  start(data) {
    this.session = GameLib.ui.shuffle(data);
    this.render();
    this.loadCard();
  },

  render() {
    document.getElementById('game-container').innerHTML = `
      <div id="flashcard-game">
        <div class="card" onclick="FlashCards.flip()"></div>
        <button onclick="FlashCards.markKnown()">I knew it</button>
        <button onclick="FlashCards.markUnknown()">Oops</button>
        <button onclick="GameHub.exitToHub()">Exit</button>
      </div>
    `;
  },

  loadCard() { /* ... */ },
  flip() { GameLib.audio.play('click'); /* ... */ },
  markKnown() { /* ... */ },
  markUnknown() { /* ... */ }
};
