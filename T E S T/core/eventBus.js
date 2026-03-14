/**
 * Event Bus
 * Decoupled communication
 */
const EventBus = {
  events: {},

  /**
   * Subscribe to event
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  },

  /**
   * Unsubscribe from event
   */
  off(event, callback) {
    if (!this.events[event]) return;
    
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  },

  /**
   * Emit event
   */
  emit(event, data) {
    if (!this.events[event]) return;
    
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in event "${event}":`, e);
      }
    });
  },

  /**
   * Clear all events
   */
  clear() {
    this.events = {};
  }
};
