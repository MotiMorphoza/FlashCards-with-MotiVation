// storage.js
const Stats = {
  addSession(game, time, errors) {
    const sessions = this.get('all_sessions', []);
    sessions.push({
      game,
      time,
      errors,
      date: Date.now()
    });
    this.set('all_sessions', sessions);
  },

  getGlobalStats() {
    // הצג סטטיסטיקות כוללות מכל המשחקים
  }
};
