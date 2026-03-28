import { AudioEngine } from "./audio.js";
import { Storage } from "./storage.js";

export class SessionEngine {
  constructor(gameType, topicMeta) {
    this.gameType = gameType;
    this.topicMeta = topicMeta;

    this.startedAt = null;
    this.elapsedTime = 0;
    this.intervalId = null;
    this.paused = false;
    this.pausedAt = null;
    this.pauseOffsetMs = 0;

    this.stats = {
      correct: 0,
      wrong: 0,
      attempts: 0,
      itemsSeen: new Set(),
    };

    this.callbacks = {
      onTick: null,
      onEnd: null,
    };
  }

  setCallbacks(callbacks = {}) {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks,
    };
  }

  start() {
    this.startedAt = Date.now();
    this.elapsedTime = 0;
    this.paused = false;
    this.pausedAt = null;
    this.pauseOffsetMs = 0;

    clearInterval(this.intervalId);
    this.intervalId = window.setInterval(() => {
      if (!this.paused) {
        this.updateElapsed();
        this.callbacks.onTick?.(this.elapsedTime, this.getStats());
      }
    }, 1000);

    this.callbacks.onTick?.(0, this.getStats());
  }

  updateElapsed(referenceTime = Date.now()) {
    if (!this.startedAt) {
      return this.elapsedTime;
    }

    const endTime = this.paused && this.pausedAt ? this.pausedAt : referenceTime;
    const raw = endTime - this.startedAt - this.pauseOffsetMs;

    this.elapsedTime = Math.max(0, Math.floor(raw / 1000));
    return this.elapsedTime;
  }

  recordCorrect(itemId) {
    this.stats.correct += 1;
    this.stats.attempts += 1;
    this.stats.itemsSeen.add(itemId);
    AudioEngine.play("success");
  }

  recordWrong(item) {
    this.stats.wrong += 1;
    this.stats.attempts += 1;
    this.stats.itemsSeen.add(item?.id || item);
    Storage.addHardItem(this.gameType, this.topicMeta, item);
    AudioEngine.play("error");
  }

  pause() {
    if (this.paused || !this.startedAt) {
      return;
    }

    this.updateElapsed();
    this.paused = true;
    this.pausedAt = Date.now();
  }

  resume() {
    if (!this.paused || !this.pausedAt) {
      return;
    }

    this.pauseOffsetMs += Date.now() - this.pausedAt;
    this.paused = false;
    this.pausedAt = null;
  }

  end(extraStats = {}) {
    clearInterval(this.intervalId);
    this.updateElapsed();

    const attempts = this.stats.attempts;
    const accuracy = attempts > 0 ? this.stats.correct / attempts : 0;

    const stats = {
      correct: this.stats.correct,
      wrong: this.stats.wrong,
      attempts,
      itemsSeen: this.stats.itemsSeen.size,
      time: this.elapsedTime,
      accuracy,
      ...extraStats,
    };

    Storage.saveGameSession(this.gameType, this.topicMeta, stats);
    const isBest = Storage.updateBestTime(this.gameType, this.topicMeta.id, stats.time);
    const bestTime = Storage.getBestTime(this.gameType, this.topicMeta.id);

    const result = { stats, isBest, bestTime };
    this.callbacks.onEnd?.(result);

    return result;
  }

  getStats() {
    this.updateElapsed();

    return {
      correct: this.stats.correct,
      wrong: this.stats.wrong,
      attempts: this.stats.attempts,
      itemsSeen: this.stats.itemsSeen.size,
      time: this.elapsedTime,
    };
  }

  destroy() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.callbacks = { onTick: null, onEnd: null };
    this.stats.itemsSeen.clear();
  }
}
