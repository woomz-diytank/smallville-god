import { GAME_CONFIG, LOCATIONS } from './constants.js';
import zh from '../i18n/zh.js';
import en from '../i18n/en.js';

const i18n = { zh, en };

class GameStateManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      // Time
      time: {
        day: 1,
        hour: GAME_CONFIG.START_HOUR,
        isPaused: true,
        speed: 1
      },

      // NPCs
      npcs: {
        elara: {
          id: 'elara',
          name: 'Elara',
          role: 'Nun',
          color: '#f5f5dc',
          personality: 'Devout, pious, clean-freak, kind-hearted',
          location: 'altar',
          action: 'lighting_candles',
          faith: 80,
          memory: [],
          thought: '愿这烛光照亮迷途者的道路...',
          interpretation: null
        },
        sly: {
          id: 'sly',
          name: 'Sly',
          role: 'Vagabond',
          color: '#696969',
          personality: 'Cynical, streetwise, opportunistic, secretly lonely',
          location: 'tavern',
          action: 'sleeping',
          faith: 20,
          memory: [],
          thought: null,
          interpretation: null
        }
      },

      // Locations
      locations: { ...LOCATIONS },

      // Resources
      faith: {
        global: GAME_CONFIG.INITIAL_FAITH,
        target: GAME_CONFIG.TARGET_FAITH
      },

      divinePower: {
        current: GAME_CONFIG.INITIAL_POWER,
        max: GAME_CONFIG.MAX_POWER
      },

      // Script
      dailyScript: null,
      currentScriptIndex: 0,

      // History (for future time-rewind feature)
      history: [],

      // UI State
      language: 'zh',
      selectedNpc: null,
      isLoading: false,
      loadingMessage: '',

      // Game Status
      gameOver: false,
      victory: false
    };
  }

  get(path) {
    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      if (value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }

  set(path, value) {
    const keys = path.split('.');
    let obj = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this.notifyListeners(path, value);
  }

  // Listeners for reactive updates
  listeners = [];

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(path, value) {
    this.listeners.forEach(callback => callback(path, value, this.state));
  }

  // Convenience methods
  getNpc(id) {
    return this.state.npcs[id];
  }

  updateNpc(id, updates) {
    Object.assign(this.state.npcs[id], updates);
    this.notifyListeners(`npcs.${id}`, this.state.npcs[id]);
  }

  getAllNpcs() {
    return Object.values(this.state.npcs);
  }

  getLocation(id) {
    return this.state.locations[id];
  }

  // Language
  t(key, params = {}) {
    const lang = this.state.language;
    const keys = key.split('.');
    let value = i18n[lang];

    for (const k of keys) {
      if (value === undefined) return key;
      value = value[k];
    }

    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }

    return value ?? key;
  }

  toggleLanguage() {
    this.state.language = this.state.language === 'zh' ? 'en' : 'zh';
    this.notifyListeners('language', this.state.language);
  }

  // Power management
  consumePower(amount) {
    if (this.state.divinePower.current >= amount) {
      this.state.divinePower.current -= amount;
      this.notifyListeners('divinePower', this.state.divinePower);
      return true;
    }
    return false;
  }

  regenPower() {
    const power = this.state.divinePower;
    if (power.current < power.max) {
      power.current = Math.min(power.max, power.current + GAME_CONFIG.POWER_REGEN_PER_HOUR);
      this.notifyListeners('divinePower', power);
    }
  }

  // Faith management
  updateGlobalFaith() {
    const npcs = Object.values(this.state.npcs);
    const avgFaith = npcs.reduce((sum, npc) => sum + npc.faith, 0) / npcs.length;
    this.state.faith.global = Math.round(avgFaith);
    this.notifyListeners('faith', this.state.faith);
    this.checkVictoryCondition();
  }

  checkVictoryCondition() {
    const faith = this.state.faith.global;
    if (faith >= this.state.faith.target) {
      this.state.gameOver = true;
      this.state.victory = true;
      this.state.time.isPaused = true;
      this.notifyListeners('gameOver', { victory: true });
    } else if (faith <= GAME_CONFIG.MIN_FAITH) {
      this.state.gameOver = true;
      this.state.victory = false;
      this.state.time.isPaused = true;
      this.notifyListeners('gameOver', { victory: false });
    }
  }

  // Loading state
  setLoading(isLoading, message = '') {
    this.state.isLoading = isLoading;
    this.state.loadingMessage = message;
    this.notifyListeners('loading', { isLoading, message });
  }
}

// Export singleton instance
export const GameState = new GameStateManager();
export default GameState;
