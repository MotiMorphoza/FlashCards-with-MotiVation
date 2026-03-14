/**
 * Session Engine
 * Manages game session lifecycle, stats, timer
 */
class SessionEngine {
  constructor(gameType, topicMeta) {
    this.gameType = gameType;
    this.topicMeta = topicMeta;
    
    this.startTime = null;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.paused = false;
    
    this.stats = {
      correct: 0,
      wrong: 0,
      attempts: 0,
      itemsSeen: new Set()
    };
    
    this.callbacks = {
      onTick: null,
      onEnd: null
    };
  }

  /**
   * Start session
   */
  start() {
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.paused = false;
    
    this.timerInterval = setInterval(() => {
      if (!this.paused) {
        this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
        this.callbacks.onTick?.(this.elapsedTime);
      }
    }, 1000);
  }

  /**
   * Record correct answer
   */
  recordCorrect(itemId) {
    this.stats.correct++;
    this.stats.attempts++;
    this.stats.itemsSeen.add(itemId);
    
    Audio.play('success');
  }

  /**
   * Record wrong answer
   */
  recordWrong(itemId) {
    this.stats.wrong++;
    this.stats.attempts++;
    this.stats.itemsSeen.add(itemId);
    
    Audio.play('error');
    
    // Track hard items
    Storage.addHardItem(this.gameType, this.topicMeta.id, itemId);
  }

  /**
   * Pause timer
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume timer
   */
  resume() {
    this.paused = false;
  }

  /**
   * End session and save stats
   */
  end() {
    clearInterval(this.timerInterval);
    
    const finalStats = {
      ...this.stats,
      time: this.elapsedTime,
      accuracy: this.stats.correct / (this.stats.correct + this.stats.wrong),
      itemsSeen: this.stats.itemsSeen.size
    };
    
    // Save to storage
    Storage.saveGameSession(this.gameType, this.topicMeta, finalStats);
    
    // Check best time
    const isBest = Storage.updateBestTime(
      this.gameType, 
      this.topicMeta.id, 
      this.elapsedTime
    );
    
    this.callbacks.onEnd?.(finalStats, isBest);
    
    return finalStats;
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      time: this.elapsedTime
    };
  }

  /**
   * Destroy engine
   */
  destroy() {
    clearInterval(this.timerInterval);
    this.callbacks = {};
  }
}
