/**
 * Unified Storage API
 * All localStorage access goes through here
 */
const Storage = {
  VERSION: 'v4',
  PREFIX: 'LLH',

  /**
   * Generate namespaced key
   */
  _key(type, game, topicId) {
    return `${this.PREFIX}_${this.VERSION}_${type}_${game}_${topicId || 'global'}`;
  },

  /**
   * Safe get
   */
  _get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Safe set
   */
  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage full:', e);
      return false;
    }
  },

  /**
   * Save game session
   */
  saveGameSession(game, topicMeta, stats) {
    const sessions = this._get(this._key('sessions', game, topicMeta.id), []);
    
    sessions.push({
      date: Date.now(),
      topic: topicMeta.name,
      lang: topicMeta.lang,
      ...stats
    });
    
    // Keep last 100 sessions
    if (sessions.length > 100) {
      sessions.splice(0, sessions.length - 100);
    }
    
    this._set(this._key('sessions', game, topicMeta.id), sessions);
    
    // Also save to global sessions
    this._addGlobalSession(game, topicMeta, stats);
  },

  /**
   * Add to global sessions (cross-game stats)
   */
  _addGlobalSession(game, topicMeta, stats) {
    const global = this._get(this._key('sessions', 'all'), []);
    
    global.push({
      date: Date.now(),
      game,
      topic: topicMeta.name,
      lang: topicMeta.lang,
      time: stats.time,
      correct: stats.correct,
      wrong: stats.wrong
    });
    
    if (global.length > 500) {
      global.splice(0, global.length - 500);
    }
    
    this._set(this._key('sessions', 'all'), global);
  },

  /**
   * Get game sessions
   */
  getGameSessions(game, topicId = null) {
    return this._get(this._key('sessions', game, topicId), []);
  },

  /**
   * Get all sessions (cross-game)
   */
  getAllSessions() {
    return this._get(this._key('sessions', 'all'), []);
  },

  /**
   * Update best time
   */
  updateBestTime(game, topicId, time) {
    const key = this._key('best', game, topicId);
    const current = this._get(key, 0);
    
    if (!current || time < current) {
      this._set(key, time);
      return true; // New record
    }
    
    return false;
  },

  /**
   * Get best time
   */
  getBestTime(game, topicId) {
    return this._get(this._key('best', game, topicId), 0);
  },

  /**
   * Add hard item
   */
  addHardItem(game, topicId, itemId) {
    const key = this._key('hard', game, topicId);
    const hard = this._get(key, {});
    
    hard[itemId] = (hard[itemId] || 0) + 1;
    
    this._set(key, hard);
  },

  /**
   * Get hard items
   */
  getHardItems(game, topicId) {
    return this._get(this._key('hard', game, topicId), {});
  },

  /**
   * Remove hard item
   */
  removeHardItem(game, topicId, itemId) {
    const key = this._key('hard', game, topicId);
    const hard = this._get(key, {});
    
    delete hard[itemId];
    
    this._set(key, hard);
  },

  /**
   * Clear all data for namespace
   */
  clearNamespace(type = null) {
    const keys = Object.keys(localStorage);
    const prefix = type 
      ? `${this.PREFIX}_${this.VERSION}_${type}_` 
      : `${this.PREFIX}_${this.VERSION}_`;
    
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  },

  /**
   * Get storage usage
   */
  getUsage() {
    let total = 0;
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith(`${this.PREFIX}_${this.VERSION}_`)) {
        total += localStorage.getItem(key).length;
      }
    });
    
    return {
      bytes: total,
      kb: (total / 1024).toFixed(2),
      mb: (total / 1024 / 1024).toFixed(2)
    };
  }
};
