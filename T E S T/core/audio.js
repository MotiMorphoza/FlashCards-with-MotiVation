/**
 * Audio Engine
 * Unified sound system
 */
const Audio = {
  ctx: null,
  enabled: true,
  initialized: false,

  /**
   * Initialize AudioContext
   */
  init() {
    if (this.initialized) return;
    
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not supported:', e);
    }
  },

  /**
   * Ensure context is running
   */
  _ensureRunning() {
    if (!this.ctx) this.init();
    
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  },

  /**
   * Play sound
   */
  play(type) {
    if (!this.enabled) return;
    
    this._ensureRunning();
    
    if (!this.ctx) return;
    
    const profiles = {
      click: { freq: 420, wave: 'sine', vol: 0.02, dur: 0.12 },
      success: { freq: 720, wave: 'triangle', vol: 0.035, dur: 0.22 },
      error: { freq: 240, wave: 'sine', vol: 0.025, dur: 0.18 },
      flip: { freq: 520, wave: 'sine', vol: 0.02, dur: 0.15 }
    };
    
    const profile = profiles[type] || profiles.click;
    
    this._playTone(profile);
  },

  /**
   * Play tone with profile
   */
  _playTone(profile) {
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = profile.wave;
    osc.frequency.setValueAtTime(profile.freq, now);
    
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(profile.vol, now + 0.03);
    gain.gain.linearRampToValueAtTime(0, now + profile.dur);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + profile.dur + 0.05);
  },

  /**
   * Toggle sound
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  /**
   * Set enabled state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
};

// Auto-init on first user interaction
document.addEventListener('click', () => Audio.init(), { once: true });
