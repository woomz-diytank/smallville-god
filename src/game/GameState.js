import behaviorLibrary from './data/behaviorLibrary.json';
import { TIME, INITIAL_STATS, UI, BUILDING_PROJECTS } from './config.js';
import SimLogger from './systems/SimLogger.js';

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
      skills: {
        PHYSICAL: [...(def.skills.PHYSICAL || [])],
        SOCIAL:   [...(def.skills.SOCIAL || [])],
        MENTAL:   [...(def.skills.MENTAL || [])],
        RESTORE:  [...(def.skills.RESTORE || [])],
      },
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
      skillProgress: {},
      learnedToday: [],
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
    const projects = {};
    for (const id of Object.keys(BUILDING_PROJECTS)) {
      projects[id] = { progress: 0, materialsDelivered: false };
    }
    this.state = {
      time: {
        day: 1,
        hour: TIME.START_HOUR,
        isPaused: true,
        speed: 1,
      },
      npcs: buildInitialNpcs(),
      locations: JSON.parse(JSON.stringify(behaviorLibrary.locations)),
      projects,
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

  // ─── 通用建筑项目 API ─────────────────────────────
  getProject(id) {
    return this.state.projects[id] || null;
  }

  getProjectDef(id) {
    return BUILDING_PROJECTS[id] || null;
  }

  isProjectBuildable(id) {
    return !!BUILDING_PROJECTS[id];
  }

  isProjectComplete(id) {
    const p = this.state.projects[id];
    const def = BUILDING_PROJECTS[id];
    if (!p || !def) return false;
    return p.progress >= def.laborHours;
  }

  areProjectMaterialsDelivered(id) {
    return !!this.state.projects[id]?.materialsDelivered;
  }

  deliverProjectMaterials(id) {
    if (this.state.projects[id]) {
      this.state.projects[id].materialsDelivered = true;
    }
  }

  advanceProject(id) {
    const def = BUILDING_PROJECTS[id];
    const p = this.state.projects[id];
    if (!def || !p) return false;
    if (p.progress >= def.laborHours) return false;
    p.progress++;
    if (p.progress >= def.laborHours) {
      const locName = def.completedName || def.nameCn;
      if (this.state.locations[id]) {
        this.state.locations[id].nameCn = locName;
      }
    }
    return true;
  }

  getProjectDisplayName(id) {
    const def = BUILDING_PROJECTS[id];
    const p = this.state.projects[id];
    if (!def || !p) {
      return this.state.locations[id]?.nameCn || id;
    }
    if (this.isProjectComplete(id)) return def.completedName || def.nameCn;
    const base = id === 'ruins' ? '废屋' : `${def.nameCn}(未建)`;
    if (p.progress > 0) return `${base} (${p.progress}/${def.laborHours}h)`;
    if (p.materialsDelivered) return `${base} (备料完成)`;
    return base;
  }

  // ─── 建筑效果查询 ────────────────────────────────
  hasHouseSleepBonus(npcId) {
    for (const [id, def] of Object.entries(BUILDING_PROJECTS)) {
      if (def.assignedTo === npcId && this.isProjectComplete(id)) return id;
    }
    return null;
  }

  isWorkshopBuilt()   { return this.isProjectComplete('workshop'); }
  isSmokehouseBuilt() { return this.isProjectComplete('smokehouse'); }
  isShrineBuilt()     { return this.isProjectComplete('shrine'); }

  // ─── 技能学习 ────────────────────────────────────
  /**
   * 查询某技能 id 属于哪个大类（PHYSICAL/SOCIAL/MENTAL/RESTORE）
   * 返回 null 表示未知技能。
   */
  getSkillCategory(skillId) {
    const skills = behaviorLibrary.skills;
    const physFlat = [
      ...skills.PHYSICAL.extraction,
      ...skills.PHYSICAL.crafting,
      ...skills.PHYSICAL.utility,
    ];
    if (physFlat.some(s => s.id === skillId)) return 'PHYSICAL';
    if (skills.SOCIAL.some(s => s.id === skillId)) return 'SOCIAL';
    if (skills.MENTAL.some(s => s.id === skillId)) return 'MENTAL';
    if (skills.RESTORE.some(s => s.id === skillId)) return 'RESTORE';
    return null;
  }

  /**
   * NPC 尚未掌握的所有可学技能 id（排除元技能与已掌握的）。
   */
  getLearnableSkills(npcId) {
    const npc = this.state.npcs[npcId];
    if (!npc) return [];
    const have = new Set([
      ...npc.skills.PHYSICAL,
      ...npc.skills.SOCIAL,
      ...npc.skills.MENTAL,
      ...npc.skills.RESTORE,
    ]);
    const META = new Set(['practice', 'learn_from']);
    const all = [];
    const skills = behaviorLibrary.skills;
    for (const s of skills.PHYSICAL.extraction) all.push(s.id);
    for (const s of skills.PHYSICAL.crafting)   all.push(s.id);
    for (const s of skills.PHYSICAL.utility)    all.push(s.id);
    for (const s of skills.SOCIAL)              all.push(s.id);
    for (const s of skills.MENTAL)              all.push(s.id);
    for (const s of skills.RESTORE)             all.push(s.id);
    return all.filter(id => !have.has(id) && !META.has(id));
  }

  /**
   * 让 NPC 习得一项新技能。记入 learnedToday，推入对应 category 数组，
   * 清除该技能的 skillProgress。返回是否实际新增（已掌握或未知技能则 false）。
   */
  grantSkill(npcId, skillId) {
    const npc = this.state.npcs[npcId];
    if (!npc) return false;
    const cat = this.getSkillCategory(skillId);
    if (!cat) return false;
    if (npc.skills[cat].includes(skillId)) {
      delete npc.skillProgress[skillId];
      return false;
    }
    npc.skills[cat].push(skillId);
    delete npc.skillProgress[skillId];
    if (!npc.learnedToday.includes(skillId)) npc.learnedToday.push(skillId);

    // 技能中文名（可能为 undefined，做兜底）
    const allSkillDefs = [
      ...behaviorLibrary.skills.PHYSICAL.extraction,
      ...behaviorLibrary.skills.PHYSICAL.crafting,
      ...behaviorLibrary.skills.PHYSICAL.utility,
      ...behaviorLibrary.skills.SOCIAL,
      ...behaviorLibrary.skills.MENTAL,
      ...behaviorLibrary.skills.RESTORE,
    ];
    const skillNameCn = allSkillDefs.find(s => s.id === skillId)?.nameCn || skillId;

    const { day, hour } = this.state.time;
    this.addLog({
      type: 'mastery',
      day,
      hour: `${String(hour).padStart(2, '0')}:00`,
      npcName: npc.nameCn,
      text: `掌握了 ${skillNameCn}！`,
    });

    try {
      SimLogger.appendMastery({
        npcId,
        npcName: npc.nameCn,
        skillId,
        skillNameCn,
      });
    } catch { /* SimLogger 可能尚未初始化 */ }

    return true;
  }

  // ─── 向下兼容的废屋专用接口（包装层） ──────────────
  deliverRuinsMaterials()  { this.deliverProjectMaterials('ruins'); }
  areMaterialsDelivered()  { return this.areProjectMaterialsDelivered('ruins'); }
  advanceRuinsRepair()     { return this.advanceProject('ruins'); }
  isRuinsRepaired()        { return this.isProjectComplete('ruins'); }
  getRuinsDisplayName()    { return this.getProjectDisplayName('ruins'); }

}

export const GameState = new GameStateManager();
export default GameState;
