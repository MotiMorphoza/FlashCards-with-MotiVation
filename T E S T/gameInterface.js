/**
 * Abstract Game Class
 * All games must extend this
 */
class GameInterface {
  constructor(gameType) {
    this.gameType = gameType;
    this.container = null;
    this.context = null;
    this.engine = null;
    this.destroyed = false;
  }

  /**
   * Initialize game
   * @param {HTMLElement} container - DOM container
   * @param {Object} context - Game context
   * @param {SessionEngine} engine - Session engine instance
   */
  async init(container, context, engine) {
    if (this.destroyed) throw new Error('Game already destroyed');
    
    this.container = container;
    this.context = context;
    this.engine = engine;
    
    await this.onInit();
  }

  /**
   * Override: Game-specific initialization
   */
  async onInit() {
    throw new Error('onInit() must be implemented');
  }

  /**
   * Override: Render game UI
   */
  render() {
    throw new Error('render() must be implemented');
  }

  /**
   * Override: Game logic update
   */
  update() {
    throw new Error('update() must be implemented');
  }

  /**
   * Pause game
   */
  pause() {
    this.engine?.pause();
  }

  /**
   * Resume game
   */
  resume() {
    this.engine?.resume();
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.destroyed) return;
    
    this.onDestroy();
    
    this.engine?.destroy();
    this.container = null;
    this.context = null;
    this.engine = null;
    this.destroyed = true;
  }

  /**
   * Override: Game-specific cleanup
   */
  onDestroy() {
    // Override in child class
  }
}
