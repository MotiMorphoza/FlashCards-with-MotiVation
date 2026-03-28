import { GameInterface } from "./gameInterface.js";
import { formatTime, shuffle } from "../utils/helpers.js";
import { setDirection } from "../utils/text.js";
import { AudioEngine } from "../core/audio.js";

export class WordMatchGame extends GameInterface {
  constructor() {
    super("wordmatch");
    this.maxVisible = 6;
    this.queue = [];
    this.activePairs = [];
    this.selectedLeft = null;
    this.selectedRight = null;
    this.locked = false;
    this.remaining = 0;
    this.pendingTimeout = null;
  }

  async onInit() {
    this.engine.setCallbacks({
      onTick: (elapsed) => {
        if (this.timerValue) {
          this.timerValue.textContent = formatTime(elapsed);
        }
      },
    });

    this.queue = shuffle(this.context.data);
    this.remaining = this.queue.length;
    this.activePairs = this.queue.splice(0, this.maxVisible);
    this.render();
    this.engine.start();
    this.renderBoard();
  }

  render() {
    this.container.innerHTML = `
      <section class="game-shell">
        <header class="game-header">
          <div>
            <p class="game-label">Word Match</p>
            <h2 id="matchTopicTitle"></h2>
          </div>
          <div class="game-metrics">
            <span class="metric-pill">Time <strong id="matchTimer">0s</strong></span>
            <span class="metric-pill">Pairs left <strong id="matchRemaining">${this.remaining}</strong></span>
          </div>
        </header>

        <div class="panel">
          <p class="support-text">Match the words on the left with their translations on the right.</p>
          <div class="match-board" id="matchBoard"></div>
        </div>
      </section>
    `;

    this.topicTitle = this.container.querySelector("#matchTopicTitle");
    this.timerValue = this.container.querySelector("#matchTimer");
    this.remainingValue = this.container.querySelector("#matchRemaining");
    this.board = this.container.querySelector("#matchBoard");
    this.topicTitle.textContent = this.context.topic.name;
  }

  renderBoard() {
    if (!this.board) {
      return;
    }

    this.board.innerHTML = "";

    const leftColumn = document.createElement("div");
    leftColumn.className = "match-column";

    const rightColumn = document.createElement("div");
    rightColumn.className = "match-column";

    const leftCards = shuffle(
      this.activePairs.map((pair) => ({
        pairId: pair.id,
        pair,
        side: "left",
        text: pair.source,
      })),
    );

    const rightCards = shuffle(
      this.activePairs.map((pair) => ({
        pairId: pair.id,
        pair,
        side: "right",
        text: pair.target,
      })),
    );

    leftCards.forEach((card) => leftColumn.appendChild(this.createCard(card)));
    rightCards.forEach((card) => rightColumn.appendChild(this.createCard(card)));

    this.board.append(leftColumn, rightColumn);
    this.remainingValue.textContent = String(this.remaining);
  }

  createCard(cardMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-card";
    button.textContent = cardMeta.text;
    setDirection(button, cardMeta.text);

    button.addEventListener("click", () => {
      this.selectCard(cardMeta, button);
    });

    return button;
  }

  selectCard(cardMeta, button) {
    if (this.locked) {
      return;
    }

    AudioEngine.play("click");

    if (cardMeta.side === "left") {
      if (this.selectedLeft?.pairId === cardMeta.pairId) {
        this.selectedLeft = null;
        button.classList.remove("is-selected");
        return;
      }

      this.clearSideSelection("left");
      this.selectedLeft = { ...cardMeta, element: button };
    } else {
      if (this.selectedRight?.pairId === cardMeta.pairId) {
        this.selectedRight = null;
        button.classList.remove("is-selected");
        return;
      }

      this.clearSideSelection("right");
      this.selectedRight = { ...cardMeta, element: button };
    }

    button.classList.add("is-selected");

    if (this.selectedLeft && this.selectedRight) {
      this.locked = true;
      this.pendingTimeout = window.setTimeout(() => this.checkMatch(), 180);
    }
  }

  clearSideSelection(side) {
    const selected = side === "left" ? this.selectedLeft : this.selectedRight;
    selected?.element?.classList.remove("is-selected");

    if (side === "left") {
      this.selectedLeft = null;
    } else {
      this.selectedRight = null;
    }
  }

  checkMatch() {
    const isMatch = this.selectedLeft?.pairId === this.selectedRight?.pairId;

    if (isMatch) {
      this.engine.recordCorrect(this.selectedLeft.pairId);
      this.handleMatch();
      return;
    }

    const pair =
      this.selectedLeft?.pair ||
      this.selectedRight?.pair ||
      this.activePairs.find((entry) => entry.id === this.selectedLeft?.pairId) ||
      null;
    this.engine.recordWrong(pair || { id: this.selectedLeft?.pairId || `miss-${Date.now()}` });
    this.selectedLeft?.element?.classList.add("is-wrong");
    this.selectedRight?.element?.classList.add("is-wrong");

    this.pendingTimeout = window.setTimeout(() => {
      this.resetSelection();
    }, 240);
  }

  handleMatch() {
    const pairId = this.selectedLeft.pairId;

    this.selectedLeft?.element?.classList.add("is-correct");
    this.selectedRight?.element?.classList.add("is-correct");

    this.pendingTimeout = window.setTimeout(() => {
      this.activePairs = this.activePairs.filter((pair) => pair.id !== pairId);
      this.remaining -= 1;

      if (this.queue.length > 0) {
        this.activePairs.push(this.queue.shift());
      }

      this.resetSelection();

      if (this.remaining === 0) {
        this.finishRound();
        return;
      }

      this.renderBoard();
    }, 260);
  }

  resetSelection() {
    this.selectedLeft?.element?.classList.remove("is-selected", "is-wrong", "is-correct");
    this.selectedRight?.element?.classList.remove("is-selected", "is-wrong", "is-correct");
    this.selectedLeft = null;
    this.selectedRight = null;
    this.locked = false;
  }

  finishRound() {
    const { stats, isBest, bestTime } = this.engine.end();

    this.container.innerHTML = `
      <section class="results-shell panel">
        <p class="game-label">Word Match</p>
        <h2>Board cleared</h2>
        <div class="results-grid">
          <div class="stat-tile"><strong>${formatTime(stats.time)}</strong><span>Time</span></div>
          <div class="stat-tile"><strong>${stats.correct}</strong><span>Matches</span></div>
          <div class="stat-tile"><strong>${stats.wrong}</strong><span>Mistakes</span></div>
          <div class="stat-tile"><strong>${formatTime(bestTime)}</strong><span>Best</span></div>
        </div>
        <p class="support-text">${isBest ? "New best time." : "Keep pushing for a faster clear."}</p>
        <div class="button-row">
          <button type="button" class="button button-success" id="matchRestart">Restart</button>
        </div>
      </section>
    `;

    this.container
      .querySelector("#matchRestart")
      .addEventListener("click", () => this.emit("app:restart-topic"));
  }

  onDestroy() {
    window.clearTimeout(this.pendingTimeout);
  }
}
