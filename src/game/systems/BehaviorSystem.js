import behaviorLibrary from '../data/behaviorLibrary.json';
import { ItemSystem } from './ItemSystem.js';
import { getItemRegistry } from '../data/ItemRegistry.js';
import GameState from '../GameState.js';
import GeminiClient from '../llm/GeminiClient.js';
import { buildGroupPrompt } from '../llm/prompts.js';
import { parseGroupResponse } from '../llm/scriptParser.js';
import MindSystem from './MindSystem.js';
import {
  TIME, NEEDS, ENV_TEMPERATURE, ENERGY_COST, RECOVERY, THRESHOLD,
  GATHER, STARTING_ITEMS, LLM, STAT_BOUNDS, MIND, BUILDING, BUILDING_PROJECTS,
  TOOL_RECIPES, REPAIR_COST, REPAIR_AMOUNT,
  HOUSE_SLEEP_MULTIPLIER, WORKSHOP_REPAIR_AMOUNT, WORKSHOP_CRAFT_DISCOUNT,
  LEARNING,
} from '../config.js';
import SimLogger from './SimLogger.js';

const allPhysicalSkills = [
  ...behaviorLibrary.skills.PHYSICAL.extraction,
  ...behaviorLibrary.skills.PHYSICAL.crafting,
  ...behaviorLibrary.skills.PHYSICAL.utility,
];

const skillMap = new Map(allPhysicalSkills.map(s => [s.id, s]));

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

class BehaviorSystemManager {
  constructor() {
    this.items = null;
    this.registry = null;
    this.llmAvailable = false;
    this.llmBusy = false;
    this._lastDay = null;
  }

  init() {
    console.log('[BehaviorSystem] init start');
    const npcIds = Object.keys(behaviorLibrary.npcs);
    const locationIds = Object.keys(behaviorLibrary.locations);
    this.items = new ItemSystem(npcIds, locationIds);
    this.registry = getItemRegistry();
    this.llmAvailable = GeminiClient.init();
    console.log('[BehaviorSystem] LLM available:', this.llmAvailable);
    this._setupInitialItems();
    MindSystem.init();
    console.log('[BehaviorSystem] init done');
  }

  _setupInitialItems() {
    const it = this.items;
    for (const { owner, item } of STARTING_ITEMS.npc) {
      it.add(owner, item);
    }
    for (const { owner, item, qty } of STARTING_ITEMS.location) {
      it.add(owner, item, qty);
    }
  }

  /**
   * Main tick: apply needs, then decide behavior (LLM or rules).
   * Returns { results, dialogues }. LLM calls happen async in the background;
   * the tick always returns immediately with rule-based fallback,
   * and LLM results (including dialogues) override on arrival.
   */
  tick() {
    const npcs = GameState.getAllNpcs();
    const phase = GameState.getPhase();
    const hour = GameState.get('time.hour');
    const day = GameState.get('time.day');
    const results = [];
    this._pendingDialogues = [];

    const sleeping = hour >= TIME.NIGHT_START || hour < TIME.NIGHT_END;
    const pressure = phase.survivalPressure || 'low';
    const coldMult = ENV_TEMPERATURE[pressure] ?? ENV_TEMPERATURE.DEFAULT;

    if (this._lastDay !== day) {
      MindSystem.resetLearnedToday();
      this._lastDay = day;
    }

    for (const npc of npcs) {
      this._applyNeeds(npc, phase, sleeping);
    }

    const npcIds = Object.keys(behaviorLibrary.npcs);
    const locationIds = Object.keys(behaviorLibrary.locations);
    SimLogger.beginTick(
      { day, hour, phase, ruinsRepair: GameState.getProject('ruins')?.progress ?? 0, sleeping, coldMultiplier: coldMult },
      npcs, this.items, npcIds, locationIds,
    );

    if (sleeping) {
      for (const npc of npcs) {
        this._doSleep(npc);
        const d = { npc: npc.id, skill: 'sleep', detail: '正在睡觉' };
        results.push(d);
        SimLogger.logDecision(d, 'sleep');
      }
      const tickIdx = SimLogger.endTick(npcs);

      if (hour === MIND.CONSOLIDATION_HOUR && !this.llmBusy) {
        this.llmBusy = true;
        MindSystem.consolidateAll(day, phase, tickIdx).finally(() => {
          this.llmBusy = false;
          GameState._notify();
        });
      }

      GameState._notify();
      return { results, dialogues: [] };
    }

    for (const npc of npcs) {
      const decision = this._decide(npc);
      this._execute(npc, decision);
      results.push(decision);
      SimLogger.logDecision(decision, 'rule');
    }

    for (const r of results) {
      if (r.skill === 'rest' || r.skill === 'sleep') continue;
      const npc = GameState.getNpc(r.npc);
      if (npc) MindSystem.recordMemory(npc, hour, r.detail);
    }

    const ruleEvents = results
      .filter(r => r.skill !== 'rest' && r.skill !== 'sleep')
      .map(r => {
        const npc = GameState.getNpc(r.npc);
        return { npcName: npc?.nameCn || r.npc, text: r.detail };
      });
    GameState.saveSnapshot(hour, ruleEvents, []);

    const tickIdx = SimLogger.endTick(npcs);

    if (this.llmAvailable && !this.llmBusy) {
      this._llmTick(npcs, hour, day, phase, tickIdx);
    }

    GameState._notify();
    return { results, dialogues: [] };
  }

  async _llmTick(npcs, hour, day, phase, tickIdx) {
    this.llmBusy = true;
    console.log(`[BehaviorSystem] LLM tick: day=${day} hour=${hour}, ${npcs.length} NPCs`);

    try {
      const groups = this._groupByLocation(npcs);
      const promises = groups.map(({ locationId, members }) =>
        this._callLLMForGroup(members, locationId, hour, day, phase, tickIdx)
      );

      const groupResults = await Promise.all(promises);
      const allDialogues = [];
      const events = [];

      for (const { actions, talks, commitments, locationId } of groupResults) {
        SimLogger.appendLLMDecisions(tickIdx, actions);

        for (const [npcId, decision] of actions) {
          const npc = GameState.getNpc(npcId);
          if (!npc) continue;

          npc.location = decision.location;
          npc.currentSkill = decision.skill;
          npc.thought = decision.brief;
          this._applySkillItems(npc, decision.skill, decision.location, decision.target);

          MindSystem.recordMemory(npc, hour, decision.brief);
          events.push({ npcName: npc.nameCn, text: decision.brief });
        }

        if (talks.length > 0) {
          const locDef = behaviorLibrary.locations[locationId];
          allDialogues.push({
            locationId,
            locName: locDef?.nameCn || locationId,
            lines: talks,
          });
          for (const t of talks) {
            const npc = GameState.getNpc(t.speakerId);
            if (npc) MindSystem.recordMemory(npc, hour, `对${t.speaker === npc.nameCn ? '别人' : t.speaker}说："${t.text}"`);
          }
        }

        for (const c of commitments) {
          MindSystem.addCommitment(c.npc, {
            day: c.day,
            hour: c.hour,
            text: c.text,
            with: c.with,
          });
          if (c.with) {
            MindSystem.addCommitment(c.with, {
              day: c.day,
              hour: c.hour,
              text: c.text,
              with: c.npc,
            });
          }
        }
      }

      SimLogger.appendDialogues(tickIdx, allDialogues);
      SimLogger.updateAfterLLM(tickIdx, npcs);

      GameState.saveSnapshot(hour, events, allDialogues);
      GameState._notify();
    } catch (err) {
      console.warn('[BehaviorSystem] LLM tick failed, rules already applied:', err.message);
    } finally {
      this.llmBusy = false;
    }
  }

  _groupByLocation(npcs) {
    const map = new Map();
    for (const npc of npcs) {
      if (!map.has(npc.location)) map.set(npc.location, []);
      map.get(npc.location).push(npc);
    }
    return [...map.entries()].map(([locationId, members]) => ({ locationId, members }));
  }

  async _callLLMForGroup(members, locationId, hour, day, phase, tickIdx) {
    const mindContext = new Map();
    for (const npc of members) {
      mindContext.set(npc.id, {
        memoryStr: MindSystem.fmtMemory(npc),
        commitStr: MindSystem.fmtCommitments(npc, day),
      });
    }

    const prompt = buildGroupPrompt({
      npcs: members,
      locationId,
      itemSystem: this.items,
      hour,
      day,
      phase,
      mindContext,
    });

    try {
      const json = await GeminiClient.generateJSON(prompt, {
        temperature: LLM.GROUP_TICK_TEMPERATURE,
        maxTokens: LLM.GROUP_TICK_MAX_TOKENS,
      });
      const rawResponse = GeminiClient.lastRawResponse;
      const { actions, talks, commitments } = parseGroupResponse(json, members);

      SimLogger.appendLLMCall(tickIdx, {
        type: 'groupTick',
        locationId,
        prompt,
        rawResponse,
        parsed: json,
        error: null,
      });

      return { actions, talks, commitments, locationId };
    } catch (err) {
      SimLogger.appendLLMCall(tickIdx, {
        type: 'groupTick',
        locationId,
        prompt,
        rawResponse: GeminiClient.lastRawResponse ?? null,
        parsed: null,
        error: err.message,
      });
      console.warn(`[BehaviorSystem] LLM call failed for ${locationId}:`, err.message);
      return { actions: new Map(), talks: [], commitments: [], locationId };
    }
  }

  _applySkillItems(npc, skillId, locationId, target = null) {
    if (skillId === 'eat') {
      this._eatUntilFull(npc);
      return;
    }
    if (skillId === 'practice') {
      this._tryPractice(npc, target);
      return;
    }
    if (skillId === 'learn_from') {
      this._tryLearnFrom(npc, target, locationId);
      return;
    }

    if (skillId === 'rest') {
      npc.energy = Math.min(STAT_BOUNDS.MAX, npc.energy + RECOVERY.REST_ENERGY);
      return;
    }
    if (skillId === 'sleep') {
      const ownHouse = GameState.hasHouseSleepBonus(npc.id);
      const mult = (ownHouse && npc.location === ownHouse) ? HOUSE_SLEEP_MULTIPLIER : 1;
      npc.energy = Math.min(STAT_BOUNDS.MAX, npc.energy + RECOVERY.SLEEP_ENERGY * mult);
      return;
    }

    if (skillId === 'build' && GameState.isProjectBuildable(locationId)) {
      this._tryBuildProject(npc, locationId);
      return;
    }
    if (skillId === 'repair_tool') {
      this._tryRepairTool(npc);
      return;
    }
    if (skillId === 'craft_tool') {
      this._tryCraftTool(npc);
      return;
    }
    if (skillId === 'smoke_meat' && !GameState.isSmokehouseBuilt()) {
      return;
    }

    const skillDef = skillMap.get(skillId);
    if (!skillDef) return;

    const check = this.items.canExecuteSkill(npc.id, skillId, locationId);
    if (check.valid) {
      this.items.applySkillResult(npc.id, skillId, locationId);
    }
  }

  _applyNeeds(npc, phase, isSleeping) {
    const pressure = phase.survivalPressure || 'low';
    const coldMult = ENV_TEMPERATURE[pressure] ?? ENV_TEMPERATURE.DEFAULT;

    const hungerDrain = isSleeping ? NEEDS.HUNGER_DRAIN_SLEEP : NEEDS.HUNGER_DRAIN_PER_HOUR;
    npc.hunger = Math.max(STAT_BOUNDS.MIN, npc.hunger - hungerDrain * coldMult);

    if (!isSleeping) {
      let energyDrain = NEEDS.ENERGY_DRAIN_PER_HOUR * coldMult;
      if (npc.hunger < THRESHOLD.HUNGER_ENERGY_PENALTY) {
        energyDrain += NEEDS.ENERGY_DRAIN_LOW_HUNGER;
      }
      npc.energy = Math.max(STAT_BOUNDS.MIN, npc.energy - energyDrain);
    }
  }

  _decide(npc) {
    if (npc.energy < THRESHOLD.ENERGY_LOW) {
      return this._restDecision(npc);
    }

    if (npc.hunger < THRESHOLD.HUNGER_LOW) {
      const eatResult = this._tryEat(npc);
      if (eatResult) return eatResult;
      const cookResult = this._tryCook(npc);
      if (cookResult) return cookResult;
      const forageResult = this._trySkill(npc, 'forage');
      if (forageResult) return forageResult;
    }

    return this._tryProductive(npc);
  }

  _restDecision(npc) {
    const restLocs = ['camp', 'ruins'];
    if (!restLocs.includes(npc.location)) {
      npc.location = 'camp';
    }
    npc.energy = Math.min(STAT_BOUNDS.MAX, npc.energy + RECOVERY.REST_ENERGY);
    return { npc: npc.id, skill: 'rest', detail: '体力不支，歇息中' };
  }

  _tryEat(npc) {
    const anyFood = RECOVERY.EAT_PRIORITY.some(f =>
      this.items.has(npc.id, f) || this.items.has(npc.location, f) || this.items.has('storehouse', f)
    );
    if (!anyFood) return null;

    const result = this._eatUntilFull(npc);
    if (!result) return null;
    return { npc: npc.id, skill: 'eat', detail: result.detail };
  }

  _eatUntilFull(npc) {
    const eaten = [];
    const sources = [npc.location, npc.id, 'storehouse'];

    while (npc.hunger < STAT_BOUNDS.MAX) {
      let ate = false;
      for (const food of RECOVERY.EAT_PRIORITY) {
        for (const src of sources) {
          if (this.items.has(src, food)) {
            if (src === 'storehouse' && npc.location !== 'storehouse') {
              npc.location = 'storehouse';
            }
            this.items.remove(src, food, 1);
            const restore = RECOVERY.EAT_RESTORE[food] || 15;
            npc.hunger = Math.min(STAT_BOUNDS.MAX, npc.hunger + restore);
            eaten.push(this.registry.get(food)?.nameCn || food);
            ate = true;
            break;
          }
        }
        if (ate) break;
      }
      if (!ate) break;
    }

    if (eaten.length === 0) return null;

    const counts = {};
    for (const name of eaten) counts[name] = (counts[name] || 0) + 1;
    const detail = Object.entries(counts).map(([n, c]) => c > 1 ? `${n}×${c}` : n).join('、');
    return { detail: `吃了${detail}` };
  }

  _tryCook(npc) {
    if (!npc.skills.PHYSICAL.includes('cook')) return null;
    const cookLocations = ['camp'];
    const cookLoc = cookLocations.find(loc =>
      (this.items.has(npc.id, 'cooking_pot') || this.items.has(loc, 'cooking_pot')) &&
      (this.items.has(loc, 'raw_meat') || this.items.has('storehouse', 'raw_meat')) &&
      (this.items.has(loc, 'timber') || this.items.has('storehouse', 'timber'))
    );
    if (!cookLoc) return null;

    npc.location = cookLoc;
    if (!this.items.has(cookLoc, 'raw_meat') && this.items.has('storehouse', 'raw_meat')) {
      this.items.transfer('storehouse', cookLoc, 'raw_meat');
    }
    if (!this.items.has(cookLoc, 'timber') && this.items.has('storehouse', 'timber')) {
      this.items.transfer('storehouse', cookLoc, 'timber');
    }
    this.items.applySkillResult(npc.id, 'cook', cookLoc);
    npc.energy -= ENERGY_COST.PHYSICAL;
    return { npc: npc.id, skill: 'cook', detail: '烹饪了一份熟肉' };
  }

  _trySkill(npc, skillId) {
    if (!npc.skills.PHYSICAL.includes(skillId)) return null;
    const skillDef = skillMap.get(skillId);
    if (!skillDef) return null;

    if (skillId === 'build') {
      const targetId = this._pickBuildTarget(npc);
      if (!targetId) return null;
      const result = this._tryBuildProject(npc, targetId);
      if (result) {
        npc.location = targetId;
        npc.energy -= ENERGY_COST.PHYSICAL;
        return { npc: npc.id, skill: 'build', detail: result.detail };
      }
      return null;
    }
    if (skillId === 'repair_tool') {
      const result = this._tryRepairTool(npc);
      if (result) {
        npc.location = GameState.isWorkshopBuilt() ? 'workshop' : 'camp';
        npc.energy -= ENERGY_COST.PHYSICAL;
        return { npc: npc.id, skill: 'repair_tool', detail: result.detail };
      }
      return null;
    }
    if (skillId === 'craft_tool') {
      const result = this._tryCraftTool(npc);
      if (result) {
        npc.location = GameState.isWorkshopBuilt() ? 'workshop' : 'camp';
        npc.energy -= ENERGY_COST.PHYSICAL;
        return { npc: npc.id, skill: 'craft_tool', detail: result.detail };
      }
      return null;
    }
    if (skillId === 'smoke_meat' && !GameState.isSmokehouseBuilt()) {
      return null;
    }

    for (const loc of skillDef.locations) {
      const check = this.items.canExecuteSkill(npc.id, skillId, loc);
      if (check.valid) {
        npc.location = loc;
        this.items.applySkillResult(npc.id, skillId, loc);
        npc.energy -= ENERGY_COST.PHYSICAL;
        return { npc: npc.id, skill: skillId, detail: skillDef.nameCn };
      }
    }
    return null;
  }

  /**
   * Rule-based selection of which building to work on.
   * Priority: ruins (highest survival priority) > current location if buildable
   * > first incomplete project with materials already delivered > any first incomplete project.
   */
  _pickBuildTarget(npc) {
    if (!GameState.isProjectComplete('ruins')) return 'ruins';
    if (GameState.isProjectBuildable(npc.location) && !GameState.isProjectComplete(npc.location)) {
      return npc.location;
    }
    for (const id of Object.keys(BUILDING_PROJECTS)) {
      if (!GameState.isProjectComplete(id) && GameState.areProjectMaterialsDelivered(id)) {
        return id;
      }
    }
    for (const id of Object.keys(BUILDING_PROJECTS)) {
      if (!GameState.isProjectComplete(id)) return id;
    }
    return null;
  }

  /**
   * Attempt to advance a building project. First build action consumes materials from
   * storehouse/project-location/npc; subsequent actions only invest labor time.
   * Returns { detail } on success, null if blocked.
   */
  _tryBuildProject(npc, projectId) {
    const def = BUILDING_PROJECTS[projectId];
    if (!def) return null;
    if (GameState.isProjectComplete(projectId)) return null;
    if (!npc.skills.PHYSICAL.includes('build')) return null;

    const hasHammer = this.items.has(npc.id, 'hammer') ||
                      this.items.has(projectId, 'hammer') ||
                      this.items.has('camp', 'hammer');
    if (!hasHammer) return null;

    if (!GameState.areProjectMaterialsDelivered(projectId)) {
      const sources = ['storehouse', projectId, 'camp', npc.id];

      for (const [matId, qty] of Object.entries(def.materials)) {
        let total = 0;
        for (const src of sources) total += this.items.getQuantity(src, matId);
        if (total < qty) return null;
      }

      for (const [matId, qty] of Object.entries(def.materials)) {
        let need = qty;
        for (const src of sources) {
          const have = this.items.getQuantity(src, matId);
          if (have <= 0) continue;
          const take = Math.min(have, need);
          this.items.remove(src, matId, take);
          need -= take;
          if (need <= 0) break;
        }
      }
      GameState.deliverProjectMaterials(projectId);
    }

    GameState.advanceProject(projectId);
    const p = GameState.getProject(projectId).progress;
    if (GameState.isProjectComplete(projectId)) {
      return { detail: `${def.completedName || def.nameCn} 建造完成！` };
    }
    return { detail: `建造${def.nameCn} (${p}/${def.laborHours}h)` };
  }

  // 旧接口包装，供历史调用点使用
  _tryBuildRepair(npc) {
    return this._tryBuildProject(npc, 'ruins');
  }

  _tryRepairTool(npc) {
    const toolReport = this.items.getToolReport();
    const worn = toolReport
      .filter(t => t.current < t.max)
      .sort((a, b) => (a.current / a.max) - (b.current / b.max));
    if (worn.length === 0) return null;

    const target = worn[0];
    const isHammerSelf = target.id === 'hammer';
    if (!isHammerSelf && !this.items.has(npc.id, 'hammer') && !this.items.has('camp', 'hammer')) {
      return null;
    }

    const sources = [npc.id, 'camp', 'storehouse'];
    for (const [matId, qty] of Object.entries(REPAIR_COST)) {
      let total = 0;
      for (const src of sources) total += this.items.getQuantity(src, matId);
      if (total < qty) return null;
    }

    for (const [matId, qty] of Object.entries(REPAIR_COST)) {
      let need = qty;
      for (const src of sources) {
        const have = this.items.getQuantity(src, matId);
        if (have <= 0) continue;
        const take = Math.min(have, need);
        this.items.remove(src, matId, take);
        need -= take;
        if (need <= 0) break;
      }
    }

    const workshopBonus = (npc.location === 'workshop' && GameState.isWorkshopBuilt())
      ? (WORKSHOP_REPAIR_AMOUNT - REPAIR_AMOUNT)
      : 0;
    const newDur = Math.min(target.current + REPAIR_AMOUNT + workshopBonus, target.max);
    this.items.setDurability(target.owner, target.id, newDur);
    const bonusTag = workshopBonus > 0 ? '（工坊加成）' : '';
    return { detail: `修理${target.nameCn} (${target.current}→${newDur}/${target.max})${bonusTag}` };
  }

  _tryCraftTool(npc) {
    const priority = ['axe', 'bow', 'needle_thread', 'cooking_pot', 'hammer'];
    const allTools = this.items.getToolReport();
    const existingIds = new Set(allTools.filter(t => !t.missing).map(t => t.id));

    const missingId = priority.find(id => !existingIds.has(id));
    if (!missingId) return null;

    const recipe = TOOL_RECIPES[missingId];
    if (!recipe) return null;

    if (!recipe.noToolRequired) {
      if (!this.items.has(npc.id, 'hammer') && !this.items.has('camp', 'hammer') && !this.items.has('workshop', 'hammer')) {
        return null;
      }
    }

    // 工坊加成：材料折扣
    const workshopActive = npc.location === 'workshop' && GameState.isWorkshopBuilt();
    const materials = { ...recipe.materials };
    if (workshopActive) {
      for (const [mat, discount] of Object.entries(WORKSHOP_CRAFT_DISCOUNT)) {
        if (materials[mat]) materials[mat] = Math.max(0, materials[mat] - discount);
      }
    }

    const sources = [npc.id, 'camp', 'workshop', 'storehouse'];
    for (const [matId, qty] of Object.entries(materials)) {
      if (qty <= 0) continue;
      let total = 0;
      for (const src of sources) total += this.items.getQuantity(src, matId);
      if (total < qty) return null;
    }

    for (const [matId, qty] of Object.entries(materials)) {
      if (qty <= 0) continue;
      let need = qty;
      for (const src of sources) {
        const have = this.items.getQuantity(src, matId);
        if (have <= 0) continue;
        const take = Math.min(have, need);
        this.items.remove(src, matId, take);
        need -= take;
        if (need <= 0) break;
      }
    }

    const itemDef = [...behaviorLibrary.items.consumable, ...behaviorLibrary.items.durable]
      .find(i => i.id === missingId);
    const maxDur = itemDef?.properties?.maxDurability;
    const placeAt = workshopActive ? 'workshop' : 'camp';
    this.items.add(placeAt, missingId, 1);
    if (maxDur) this.items.setDurability(placeAt, missingId, maxDur);

    const nameCn = itemDef?.nameCn || missingId;
    const bonusTag = workshopActive ? '（工坊加成）' : '';
    return { detail: `制作了新的${nameCn}${bonusTag}` };
  }

  // ─── 技能学习 ────────────────────────────────────
  /**
   * 返回 NPC 已掌握的所有技能 id 集合（不含元技能）。
   */
  _collectNpcSkills(npc) {
    return new Set([
      ...npc.skills.PHYSICAL,
      ...npc.skills.SOCIAL,
      ...npc.skills.MENTAL,
      ...npc.skills.RESTORE,
    ]);
  }

  /**
   * 自学练习某技能：每次 +PRACTICE_GAIN 进度。
   * 若 target 未指定或已掌握，则回退为原地休息（详情空，avoid 奇怪日志）。
   */
  _tryPractice(npc, targetSkill) {
    if (!targetSkill) return null;
    const cat = GameState.getSkillCategory(targetSkill);
    if (!cat) return null;
    if (this._collectNpcSkills(npc).has(targetSkill)) {
      delete npc.skillProgress[targetSkill];
      return null;
    }
    const cur = (npc.skillProgress[targetSkill] || 0) + LEARNING.PRACTICE_GAIN;
    npc.skillProgress[targetSkill] = cur;
    npc.thought = `练习 ${this._skillNameCn(targetSkill)} (${cur}/${LEARNING.AUTO_MASTER_AT})`;

    if (cur >= LEARNING.AUTO_MASTER_AT && !this.llmAvailable) {
      GameState.grantSkill(npc.id, targetSkill);
      npc.thought = `掌握了 ${this._skillNameCn(targetSkill)}`;
    }
    return { detail: npc.thought };
  }

  /**
   * 向同地点的 NPC 请教某技能：每次 +LEARN_FROM_GAIN。
   * 若无合适老师，降级为 practice（gain 变为 PRACTICE_GAIN）避免空转。
   */
  _tryLearnFrom(npc, targetSkill, locationId) {
    if (!targetSkill) return null;
    const cat = GameState.getSkillCategory(targetSkill);
    if (!cat) return null;
    if (this._collectNpcSkills(npc).has(targetSkill)) {
      delete npc.skillProgress[targetSkill];
      return null;
    }

    const locId = locationId || npc.location;
    const teacher = GameState.getAllNpcs().find(other => {
      if (other.id === npc.id) return false;
      if (other.location !== locId) return false;
      return this._collectNpcSkills(other).has(targetSkill);
    });

    const gain = teacher ? LEARNING.LEARN_FROM_GAIN : LEARNING.PRACTICE_GAIN;
    const cur = (npc.skillProgress[targetSkill] || 0) + gain;
    npc.skillProgress[targetSkill] = cur;

    if (teacher) {
      npc.thought = `向 ${teacher.nameCn} 学 ${this._skillNameCn(targetSkill)} (${cur}/${LEARNING.AUTO_MASTER_AT})`;
    } else {
      npc.thought = `独自揣摩 ${this._skillNameCn(targetSkill)} (${cur}/${LEARNING.AUTO_MASTER_AT})`;
    }

    if (cur >= LEARNING.AUTO_MASTER_AT && !this.llmAvailable) {
      GameState.grantSkill(npc.id, targetSkill);
      npc.thought = `掌握了 ${this._skillNameCn(targetSkill)}`;
    }
    return { detail: npc.thought };
  }

  _skillNameCn(skillId) {
    const all = [
      ...behaviorLibrary.skills.PHYSICAL.extraction,
      ...behaviorLibrary.skills.PHYSICAL.crafting,
      ...behaviorLibrary.skills.PHYSICAL.utility,
      ...behaviorLibrary.skills.SOCIAL,
      ...behaviorLibrary.skills.MENTAL,
      ...behaviorLibrary.skills.RESTORE,
    ];
    return all.find(s => s.id === skillId)?.nameCn || skillId;
  }

  /**
   * 规则路径下兜底延续学习进度。
   * 若 NPC 已有学习进度（>0），延续 practice 那一项。
   * 不会在规则路径主动开启新学习项——保守策略。
   */
  _tryLearn(npc) {
    const progress = npc.skillProgress || {};
    const entries = Object.entries(progress);
    if (entries.length === 0) return null;

    entries.sort((a, b) => b[1] - a[1]);
    const [targetSkill] = entries[0];
    const result = this._tryPractice(npc, targetSkill);
    if (result) {
      npc.currentSkill = 'practice';
      npc.energy -= ENERGY_COST.MENTAL;
      return { npc: npc.id, skill: 'practice', detail: result.detail };
    }
    return null;
  }

  _tryProductive(npc) {
    const physicalSkills = npc.skills.PHYSICAL.filter(
      s => !['tend_fire', 'haul'].includes(s)
    );

    const shuffled = [...physicalSkills].sort(() => Math.random() - 0.5);

    for (const skillId of shuffled) {
      const result = this._trySkill(npc, skillId);
      if (result) return result;
    }

    const utilResult = this._trySkill(npc, 'tend_fire') || this._trySkill(npc, 'haul');
    if (utilResult) return utilResult;

    const socialSkills = npc.skills.SOCIAL || [];
    if (socialSkills.length > 0) {
      const social = pick(socialSkills);
      const socialDef = behaviorLibrary.skills.SOCIAL.find(s => s.id === social);
      if (socialDef) {
        const loc = socialDef.locations.find(l => true) || npc.location;
        npc.location = loc;
        npc.energy -= ENERGY_COST.SOCIAL;
        return { npc: npc.id, skill: social, detail: socialDef.nameCn };
      }
    }

    // 规则路径兜底延续已有学习进度（不主动开启新学习）
    const learnResult = this._tryLearn(npc);
    if (learnResult) return learnResult;

    const mentalSkills = (npc.skills.MENTAL || []).filter(
      s => s !== 'practice' && s !== 'learn_from'
    );
    if (mentalSkills.length > 0) {
      const mental = pick(mentalSkills);
      const mentalDef = behaviorLibrary.skills.MENTAL.find(s => s.id === mental);
      if (mentalDef) {
        const loc = mentalDef.locations.find(l => true) || npc.location;
        npc.location = loc;
        npc.energy -= ENERGY_COST.MENTAL;
        return { npc: npc.id, skill: mental, detail: mentalDef.nameCn };
      }
    }

    npc.energy = Math.min(STAT_BOUNDS.MAX, npc.energy + RECOVERY.REST_ENERGY);
    return { npc: npc.id, skill: 'rest', detail: '无事可做，歇息' };
  }

  _doSleep(npc) {
    const ownHouse = GameState.hasHouseSleepBonus(npc.id);
    const sleepLocs = ['camp', 'ruins', 'house_agnes', 'house_roderic', 'house_oskar'];
    if (ownHouse) {
      npc.location = ownHouse;
    } else if (!sleepLocs.includes(npc.location)) {
      npc.location = GameState.isRuinsRepaired() ? 'ruins' : 'camp';
    }
    const mult = (ownHouse && npc.location === ownHouse) ? HOUSE_SLEEP_MULTIPLIER : 1;
    npc.energy = Math.min(STAT_BOUNDS.MAX, npc.energy + RECOVERY.SLEEP_ENERGY * mult);
    npc.currentSkill = 'sleep';
    npc.thought = '';
  }

  _execute(npc, decision) {
    npc.currentSkill = decision.skill;
    npc.thought = decision.detail;
  }

  getItemSystem() {
    return this.items;
  }
}

export const BehaviorSystem = new BehaviorSystemManager();
export default BehaviorSystem;
