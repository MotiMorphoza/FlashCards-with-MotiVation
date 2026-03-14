/**
 * Simple Router
 * Manages screen navigation
 */
const Router = {
  currentScreen: 'home',
  history: [],
  screens: new Map(),

  /**
   * Register screen
   */
  register(name, element) {
    this.screens.set(name, element);
  },

  /**
   * Navigate to screen
   */
  navigate(screen, addToHistory = true) {
    if (!this.screens.has(screen)) {
      console.error(`Screen "${screen}" not found`);
      return;
    }
    
    // Hide all screens
    this.screens.forEach((el, name) => {
      el.classList.toggle('active', name === screen);
    });
    
    // Update history
    if (addToHistory && screen !== this.currentScreen) {
      this.history.push(this.currentScreen);
    }
    
    this.currentScreen = screen;
    
    // Trigger event
    EventBus.emit('screen:change', { screen });
  },

  /**
   * Go back
   */
  back() {
    if (this.history.length === 0) {
      this.navigate('home', false);
      return;
    }
    
    const previous = this.history.pop();
    this.navigate(previous, false);
  },

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }
};
