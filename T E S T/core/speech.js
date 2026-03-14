/**
 * Speech Engine
 * Text-to-Speech wrapper
 */
const Speech = {
  enabled: true,
  voices: [],
  voicesLoaded: false,

  /**
   * Initialize voices
   */
  init() {
    if (this.voicesLoaded) return Promise.resolve();
    
    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = speechSynthesis.getVoices();
        this.voicesLoaded = true;
        resolve();
      };
      
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      loadVoices();
    });
  },

  /**
   * Get lang code from language pair
   */
  _getLangCode(langPair) {
    const first = langPair.split('-')[0];
    const map = {
      'he': 'he-IL',
      'en': 'en-US',
      'ar': 'ar-SA',
      'es': 'es-ES',
      'pl': 'pl-PL'
    };
    return map[first] || 'en-US';
  },

  /**
   * Find voice for language
   */
  _findVoice(langCode) {
    const langPrefix = langCode.split('-')[0];
    
    return this.voices.find(v => 
      v.lang.startsWith(langPrefix)
    );
  },

  /**
   * Speak text
   */
  async speak(text, langPair, options = {}) {
    if (!this.enabled) return;
    
    await this.init();
    
    const langCode = this._getLangCode(langPair);
    const voice = this._findVoice(langCode);
    
    if (!voice) {
      console.warn(`No voice found for ${langCode}`);
      return;
    }
    
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = langCode;
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    
    speechSynthesis.speak(utterance);
  },

  /**
   * Stop speaking
   */
  stop() {
    speechSynthesis.cancel();
  },

  /**
   * Toggle speech
   */
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stop();
    return this.enabled;
  }
};
