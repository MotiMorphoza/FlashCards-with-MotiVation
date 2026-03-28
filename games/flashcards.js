import { GameInterface } from "./gameInterface.js";
import { formatTime, safePercent, shuffle } from "../utils/helpers.js";
import { setDirection } from "../utils/text.js";
import { AudioEngine } from "../core/audio.js";

export class FlashCardsGame extends GameInterface {
  constructor() {
    super("flashcards");
    this.deck = [];
    this.currentIndex = 0;
    this.flipped = false;
    this.direction = "source";
  }

  async onInit() {
    this.engine.setCallbacks({
      onTick: (elapsed) => {
        if (this.timerValue) {
          this.timerValue.textContent = formatTime(elapsed);
        }
      },
    });

    this.startRound();
  }

  startRound() {
    this.deck = shuffle(this.context.data);
    this.currentIndex = 0;
    this.flipped = false;
    this.direction = "source";

    this.render();
    this.bindEvents();
    this.engine.start();
    this.loadCard();
  }

  render() {
    this.container.innerHTML = `
      <section class="game-shell">
        <header class="game-header">
          <div>
            <p class="game-label">Flash Cards</p>
            <h2 id="flashTopicTitle"></h2>
          </div>
          <div class="game-metrics">
            <span class="metric-pill">Time <strong id="flashTimer">0s</strong></span>
            <span class="metric-pill">Remaining <strong id="flashRemaining">0</strong></span>
            <button type="button" class="button button-ghost button-small" id="flashHome">Home</button>
          </div>
        </header>

        <div class="panel flash-panel">
          <button type="button" class="flash-card" id="flashCard">
            <span id="flashCardText"></span>
          </button>
          <p class="support-text">Tap the card to flip it.</p>
        </div>

        <div class="button-row">
          <button type="button" class="button button-success" id="flashKnown">I knew it</button>
          <button type="button" class="button button-danger" id="flashUnknown">Need another round</button>
        </div>

        <div class="button-row">
          <button type="button" class="button button-forest" id="flashShuffle">Shuffle</button>
          <button type="button" class="button button-secondary" id="flashDirection">Flip direction</button>
        </div>
      </section>
    `;

    this.topicTitle = this.container.querySelector("#flashTopicTitle");
    this.timerValue = this.container.querySelector("#flashTimer");
    this.remainingValue = this.container.querySelector("#flashRemaining");
    this.cardButton = this.container.querySelector("#flashCard");
    this.cardText = this.container.querySelector("#flashCardText");
    this.knownButton = this.container.querySelector("#flashKnown");
    this.unknownButton = this.container.querySelector("#flashUnknown");
    this.shuffleButton = this.container.querySelector("#flashShuffle");
    this.directionButton = this.container.querySelector("#flashDirection");
    this.homeButton = this.container.querySelector("#flashHome");
    this.topicTitle.textContent = this.context.topic.name;
  }

  bindEvents() {
    this.handleFlip = () => {
      this.flipped = !this.flipped;
      AudioEngine.play("flip");
      this.updateCard();
    };

    this.handleKnown = () => {
      const current = this.deck[this.currentIndex];
      if (!current) {
        return;
      }

      this.engine.recordCorrect(current.id);
      this.currentIndex += 1;
      this.flipped = false;
      this.loadCard();
    };

    this.handleUnknown = () => {
      const current = this.deck[this.currentIndex];
      if (!current) {
        return;
      }

      this.engine.recordWrong(current);
      this.deck.push(current);
      this.currentIndex += 1;
      this.flipped = false;
      this.loadCard();
    };

    this.handleDirection = () => {
      this.direction = this.direction === "source" ? "target" : "source";
      this.flipped = false;
      this.updateCard();
    };

    this.handleShuffle = () => {
      const remaining = this.deck.slice(this.currentIndex);
      if (remaining.length <= 1) {
        return;
      }

      this.deck = [
        ...this.deck.slice(0, this.currentIndex),
        ...shuffle(remaining),
      ];
      this.flipped = false;
      this.updateCard();
    };

    this.handleHome = () => {
      this.emit("app:show-home");
    };

    this.cardButton.addEventListener("click", this.handleFlip);
    this.knownButton.addEventListener("click", this.handleKnown);
    this.unknownButton.addEventListener("click", this.handleUnknown);
    this.shuffleButton.addEventListener("click", this.handleShuffle);
    this.directionButton.addEventListener("click", this.handleDirection);
    this.homeButton.addEventListener("click", this.handleHome);
  }

  loadCard() {
    if (this.currentIndex >= this.deck.length) {
      this.finishRound();
      return;
    }

    this.updateCard();
  }

  updateCard() {
    const current = this.deck[this.currentIndex];
    if (!current) {
      return;
    }

    const frontKey = this.direction;
    const backKey = this.direction === "source" ? "target" : "source";
    const text = this.flipped ? current[backKey] : current[frontKey];

    this.cardText.textContent = text;
    setDirection(this.cardText, text);
    this.remainingValue.textContent = String(this.deck.length - this.currentIndex);
  }

  finishRound() {
    const result = this.engine.end();
    const { stats, isBest, bestTime } = result;

    this.container.innerHTML = `
      <section class="results-shell panel">
        <p class="game-label">Flash Cards</p>
        <h2>Session complete</h2>
        <div class="results-grid">
          <div class="stat-tile"><strong>${formatTime(stats.time)}</strong><span>Time</span></div>
          <div class="stat-tile"><strong>${stats.correct}</strong><span>Correct</span></div>
          <div class="stat-tile"><strong>${stats.wrong}</strong><span>Wrong</span></div>
          <div class="stat-tile"><strong>${safePercent(stats.correct, stats.attempts)}%</strong><span>Accuracy</span></div>
        </div>
        <p class="support-text">${isBest ? "New best time." : `Best time: ${formatTime(bestTime)}`}</p>
        <div class="button-row">
          <button type="button" class="button button-success" id="flashRestart">Restart</button>
          <button type="button" class="button button-secondary" id="flashBackHome">Home</button>
        </div>
      </section>
    `;

    this.container
      .querySelector("#flashRestart")
      .addEventListener("click", () => this.emit("app:restart-topic"));
    this.container
      .querySelector("#flashBackHome")
      .addEventListener("click", () => this.emit("app:show-home"));
  }

  onDestroy() {
    this.cardButton?.removeEventListener("click", this.handleFlip);
    this.knownButton?.removeEventListener("click", this.handleKnown);
    this.unknownButton?.removeEventListener("click", this.handleUnknown);
    this.shuffleButton?.removeEventListener("click", this.handleShuffle);
    this.directionButton?.removeEventListener("click", this.handleDirection);
    this.homeButton?.removeEventListener("click", this.handleHome);
  }
}
