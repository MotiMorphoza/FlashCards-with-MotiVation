import { GameInterface } from "./gameInterface.js";
import { formatTime, shuffle } from "../utils/helpers.js";
import { setDirection, tokenizeSentence } from "../utils/text.js";
import { AudioEngine } from "../core/audio.js";
import { SpeechEngine } from "../core/speech.js";

export class WordPuzzleGame extends GameInterface {
  constructor() {
    super("wordpuzzle");
    this.sentences = [];
    this.currentIndex = 0;
    this.currentSentence = null;
    this.sourceTokens = [];
    this.bankTokens = [];
    this.builtTokens = [];
    this.solved = false;
    this.canCountWrong = true;
  }

  async onInit() {
    this.engine.setCallbacks({
      onTick: (elapsed) => {
        if (this.timerValue) {
          this.timerValue.textContent = formatTime(elapsed);
        }
      },
    });

    this.sentences = shuffle(this.context.data);
    this.render();
    this.engine.start();
    this.loadSentence();
  }

  render() {
    this.container.innerHTML = `
      <section class="game-shell">
        <header class="game-header">
          <div>
            <p class="game-label">Word Puzzle</p>
            <h2 id="puzzleTopicTitle"></h2>
          </div>
          <div class="game-metrics">
            <span class="metric-pill">Time <strong id="puzzleTimer">0s</strong></span>
            <span class="metric-pill">Progress <strong id="puzzleProgress">0 / 0</strong></span>
          </div>
        </header>

        <div class="panel">
          <p class="support-text">Rebuild the source sentence from the word bank.</p>
          <div class="translation-card">
            <span class="translation-label">Translation</span>
            <p id="puzzleTranslation"></p>
          </div>
          <div class="token-zone token-zone--built" id="puzzleBuilt"></div>
          <div class="token-zone" id="puzzleBank"></div>
          <div class="button-row">
            <button type="button" class="button button-secondary" id="puzzleSpeak" disabled>Speak sentence</button>
            <button type="button" class="button button-success" id="puzzleNext" disabled>Next sentence</button>
          </div>
          <div class="button-row">
            <button type="button" class="button button-ghost" id="puzzleExit">Exit</button>
          </div>
        </div>
      </section>
    `;

    this.topicTitle = this.container.querySelector("#puzzleTopicTitle");
    this.timerValue = this.container.querySelector("#puzzleTimer");
    this.progressValue = this.container.querySelector("#puzzleProgress");
    this.translationValue = this.container.querySelector("#puzzleTranslation");
    this.builtZone = this.container.querySelector("#puzzleBuilt");
    this.bankZone = this.container.querySelector("#puzzleBank");
    this.speakButton = this.container.querySelector("#puzzleSpeak");
    this.nextButton = this.container.querySelector("#puzzleNext");
    this.exitButton = this.container.querySelector("#puzzleExit");
    this.topicTitle.textContent = this.context.topic.name;

    this.handleSpeak = () => {
      if (this.currentSentence) {
        SpeechEngine.speak(this.currentSentence.source, this.context.lang);
      }
    };

    this.handleNext = () => {
      this.currentIndex += 1;
      this.loadSentence();
    };

    this.handleExit = () => {
      this.emit("app:show-home");
    };

    this.speakButton.addEventListener("click", this.handleSpeak);
    this.nextButton.addEventListener("click", this.handleNext);
    this.exitButton.addEventListener("click", this.handleExit);
  }

  loadSentence() {
    if (this.currentIndex >= this.sentences.length) {
      this.finishRound();
      return;
    }

    this.currentSentence = this.sentences[this.currentIndex];
    this.sourceTokens = tokenizeSentence(this.currentSentence.source);
    this.bankTokens = shuffle(
      this.sourceTokens.map((text, index) => ({
        id: `${this.currentSentence.id}:${index}`,
        text,
      })),
    );
    this.builtTokens = [];
    this.solved = false;
    this.canCountWrong = true;

    this.translationValue.textContent = this.currentSentence.target;
    setDirection(this.translationValue, this.currentSentence.target);

    this.progressValue.textContent = `${this.currentIndex + 1} / ${this.sentences.length}`;
    this.speakButton.disabled = true;
    this.nextButton.disabled = true;

    this.renderTokens();
  }

  renderTokens() {
    this.builtZone.innerHTML = "";
    this.bankZone.innerHTML = "";

    const isSourceRTL = this.sourceTokens.some((token) => /[\u0591-\u07FF]/.test(token));
    this.builtZone.dir = isSourceRTL ? "rtl" : "ltr";
    this.bankZone.dir = isSourceRTL ? "rtl" : "ltr";

    this.builtTokens.forEach((token) => {
      this.builtZone.appendChild(this.createTokenButton(token, true));
    });

    this.bankTokens.forEach((token) => {
      this.bankZone.appendChild(this.createTokenButton(token, false));
    });

    this.evaluateSentence();
  }

  createTokenButton(token, fromBuiltZone) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "token-button";
    button.textContent = token.text;
    button.classList.toggle("token-button--built", fromBuiltZone);
    button.addEventListener("click", () => {
      this.moveToken(token.id, fromBuiltZone);
    });
    return button;
  }

  moveToken(tokenId, fromBuiltZone) {
    if (this.solved) {
      return;
    }

    AudioEngine.play("click");
    this.canCountWrong = true;

    if (fromBuiltZone) {
      const index = this.builtTokens.findIndex((token) => token.id === tokenId);
      if (index >= 0) {
        this.bankTokens.push(this.builtTokens[index]);
        this.builtTokens.splice(index, 1);
      }
    } else {
      const index = this.bankTokens.findIndex((token) => token.id === tokenId);
      if (index >= 0) {
        this.builtTokens.push(this.bankTokens[index]);
        this.bankTokens.splice(index, 1);
      }
    }

    this.renderTokens();
  }

  evaluateSentence() {
    const built = this.builtTokens.map((token) => token.text).join(" ");
    const target = this.sourceTokens.join(" ");

    this.nextButton.disabled = built !== target;
    this.speakButton.disabled = built !== target;

    if (built === target && !this.solved) {
      this.solved = true;
      this.engine.recordCorrect(this.currentSentence.id);
      return;
    }

    if (
      built !== target &&
      this.builtTokens.length === this.sourceTokens.length &&
      this.canCountWrong
    ) {
      this.canCountWrong = false;
      this.engine.recordWrong(this.currentSentence.id);
      this.builtZone.classList.add("token-zone--error");
      window.setTimeout(() => {
        this.builtZone?.classList.remove("token-zone--error");
      }, 220);
    }
  }

  finishRound() {
    const { stats, isBest, bestTime } = this.engine.end();

    this.container.innerHTML = `
      <section class="results-shell panel">
        <p class="game-label">Word Puzzle</p>
        <h2>Session complete</h2>
        <div class="results-grid">
          <div class="stat-tile"><strong>${formatTime(stats.time)}</strong><span>Time</span></div>
          <div class="stat-tile"><strong>${stats.correct}</strong><span>Solved</span></div>
          <div class="stat-tile"><strong>${stats.wrong}</strong><span>Retries</span></div>
          <div class="stat-tile"><strong>${formatTime(bestTime)}</strong><span>Best</span></div>
        </div>
        <p class="support-text">${isBest ? "New best time." : "You can replay to improve your pace."}</p>
        <div class="button-row">
          <button type="button" class="button button-success" id="puzzleRestart">Restart</button>
          <button type="button" class="button button-secondary" id="puzzleBackHome">Home</button>
        </div>
      </section>
    `;

    this.container
      .querySelector("#puzzleRestart")
      .addEventListener("click", () => this.emit("app:restart-topic"));
    this.container
      .querySelector("#puzzleBackHome")
      .addEventListener("click", () => this.emit("app:show-home"));
  }

  onDestroy() {
    this.speakButton?.removeEventListener("click", this.handleSpeak);
    this.nextButton?.removeEventListener("click", this.handleNext);
    this.exitButton?.removeEventListener("click", this.handleExit);
    SpeechEngine.stop();
  }
}
