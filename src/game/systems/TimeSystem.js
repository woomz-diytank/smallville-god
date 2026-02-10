import { GAME_CONFIG } from '../constants.js';
import GameState from '../GameState.js';

class TimeSystemManager {
  constructor() {
    this.intervalId = null;
    this.onHourChange = null;
    this.onDayChange = null;
  }

  init(callbacks = {}) {
    this.onHourChange = callbacks.onHourChange || (() => {});
    this.onDayChange = callbacks.onDayChange || (() => {});
  }

  start() {
    if (this.intervalId) return;

    const tick = () => {
      if (GameState.get('gameOver')) {
        this.stop();
        return;
      }
      if (GameState.get('time.isPaused')) return;

      this.advanceHour();
    };

    const speed = GameState.get('time.speed');
    const interval = GAME_CONFIG.MS_PER_GAME_HOUR / speed;
    this.intervalId = setInterval(tick, interval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  advanceHour() {
    let hour = GameState.get('time.hour');
    let day = GameState.get('time.day');

    hour++;

    if (hour >= GAME_CONFIG.HOURS_PER_DAY) {
      hour = 0;
      day++;
      GameState.set('time.day', day);
      this.onDayChange(day);
    }

    GameState.set('time.hour', hour);
    GameState.regenPower();
    this.onHourChange(hour, day);
  }

  togglePause() {
    const isPaused = GameState.get('time.isPaused');
    GameState.set('time.isPaused', !isPaused);

    if (!isPaused) {
      this.stop();
    } else {
      this.start();
    }

    return !isPaused;
  }

  cycleSpeed() {
    const currentSpeed = GameState.get('time.speed');
    const speeds = GAME_CONFIG.SPEED_OPTIONS;
    const currentIndex = speeds.indexOf(currentSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];

    GameState.set('time.speed', newSpeed);

    // Restart timer with new speed if running
    if (!GameState.get('time.isPaused')) {
      this.stop();
      this.start();
    }

    return newSpeed;
  }

  getFormattedTime() {
    const hour = GameState.get('time.hour');
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  getFormattedDay() {
    const day = GameState.get('time.day');
    return GameState.t('day', { n: day });
  }
}

export const TimeSystem = new TimeSystemManager();
export default TimeSystem;
