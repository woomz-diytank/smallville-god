import behaviorLibrary from './data/behaviorLibrary.json';
import { TIME, INITIAL_STATS, UI, BUILDING } from './config.js';

function getPhase(week) {
  const phases = behaviorLibrary.winterPhases;
  for (const [, phase] of Object.entries(phases)) {
    if (phase.weeks.includes(week)) return phase;
  }
  return Object.values(phases)[0];
}

function buildInitialNpcs() {
  const npcs = {};
  for (const [id, def] of Object.entries(behaviorLibrary.npcs)) {
    npcs[id] = {
      id,
      name: def.name,
      nameCn: def.nameCn,
      age: def.age,
      skills: def.skills,
      needs: def.needs,
      personality: def.personality,
      background: def.background,
      learningPotential: def.learningPotential || [],
      location: 'camp',
      currentSkill: null,
      thought: '',
      hunger: INITIAL_STATS.HUNGER,
      energy: INITIAL_STATS.ENERGY,
      memory: [],
      commitments: [],
      shortTermGoal: '',
      longTermGoal: '',
      daySummary: '',
      pastSummaries: [],
    };
  }
  return npcs;
}

class GameStateManager {
  constructor() {
    this.state = null;
    this._listeners = [];
    this.reset();
  }

  reset() {
    this.state = {
      time: {
        day: 1,
        hour: TIME.START_HOUR,
        isPaused: true,
        speed: 1,
      },
      npcs: buildInitialNpcs(),
      locations: JSON.parse(JSON.stringify(behaviorLibrary.locations)),
      ruinsRepairProgress: 0,    // labor hours invested
      ruinsMaterialsDelivered: false,
      log: [],
      dayTimeline: {},
      viewingHour: null,
      latestDialogues: [],
    };
    this._notify();
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  set(path, value) {
    const keys = path.split('.');
    let obj = this.state;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._notify();
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _notify() {
    for (const fn of this._listeners) fn(this.state);
  }

  getWeek() {
    return Math.ceil(this.state.time.day / TIME.DAYS_PER_WEEK);
  }

  getPhase() {
    return getPhase(this.getWeek());
  }

  getNpc(id) {
    return this.state.npcs[id];
  }

  getAllNpcs() {
    return Object.values(this.state.npcs);
  }

  getNpcsAtLocation(locationId) {
    return this.getAllNpcs().filter(n => n.location === locationId);
  }

  updateNpc(id, updates) {
    Object.assign(this.state.npcs[id], updates);
    this._notify();
  }

  addLog(entry) {
    this.state.log.unshift(entry);
    if (this.state.log.length > UI.MAX_LOG_ENTRIES) this.state.log.length = UI.MAX_LOG_ENTRIES;
  }

  advanceHour() {
    let { hour, day } = this.state.time;
    hour++;
    if (hour >= TIME.HOURS_PER_DAY) {
      hour = 0;
      day++;
      this.state.dayTimeline = {};
    }
    this.state.time.hour = hour;
    this.state.time.day = day;
    return { hour, day };
  }

  saveSnapshot(hour, events, dialogues) {
    const npcClone = {};
    for (const [id, npc] of Object.entries(this.state.npcs)) {
      npcClone[id] = {
        id: npc.id,
        nameCn: npc.nameCn,
        location: npc.location,
        currentSkill: npc.currentSkill,
        thought: npc.thought,
        hunger: npc.hunger,
        energy: npc.energy,
        shortTermGoal: npc.shortTermGoal,
        longTermGoal: npc.longTermGoal,
      };
    }
    this.state.dayTimeline[hour] = { hour, npcs: npcClone, events, dialogues };
    if (dialogues && dialogues.length > 0) {
      this.state.latestDialogues = dialogues;
    }
  }

  getSnapshot(hour) {
    return this.state.dayTimeline[hour] || null;
  }

  getTimelineHours() {
    return Object.keys(this.state.dayTimeline).map(Number).sort((a, b) => a - b);
  }

  getDayStartHour() {
    return this.state.time.day === 1 ? TIME.START_HOUR : 0;
  }

  setViewingHour(hour) {
    this.state.viewingHour = hour;
    this._notify();
  }

  clearViewing() {
    this.state.viewingHour = null;
    this._notify();
  }

  togglePause() {
    this.state.time.isPaused = !this.state.time.isPaused;
    this._notify();
    return this.state.time.isPaused;
  }

  cycleSpeed() {
    const speeds = TIME.SPEED_OPTIONS;
    const i = speeds.indexOf(this.state.time.speed);
    this.state.time.speed = speeds[(i + 1) % speeds.length];
    this._notify();
    return this.state.time.speed;
  }

  deliverRuinsMaterials() {
    this.state.ruinsMaterialsDelivered = true;
  }

  areMaterialsDelivered() {
    return this.state.ruinsMaterialsDelivered;
  }

  advanceRuinsRepair() {
    if (this.state.ruinsRepairProgress >= BUILDING.LABOR_HOURS) return false;
    this.state.ruinsRepairProgress++;
    if (this.state.ruinsRepairProgress >= BUILDING.LABOR_HOURS) {
      this.state.locations.ruins.nameCn = '小屋';
    }
    return true;
  }

  isRuinsRepaired() {
    return this.state.ruinsRepairProgress >= BUILDING.LABOR_HOURS;
  }

  getRuinsDisplayName() {
    if (this.isRuinsRepaired()) return '小屋';
    const p = this.state.ruinsRepairProgress;
    if (p > 0) return `废屋 (${p}/${BUILDING.LABOR_HOURS}h)`;
    if (this.state.ruinsMaterialsDelivered) return '废屋 (备料完成)';
    return '废屋';
  }
}

export const GameState = new GameStateManager();
export default GameState;
