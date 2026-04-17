/**
 * SimLogger — Persistent simulation logger.
 *
 * Captures a complete record of every tick: NPC states before/after decisions,
 * inventories, rule-based decisions, LLM prompts & responses, dialogues,
 * and nightly consolidation. Outputs a single JSON file for offline analysis.
 *
 * Storage strategy:
 *   - Current session accumulates in memory.
 *   - Auto-saved to localStorage every few ticks and on beforeunload.
 *   - On page load, previous session is moved to a "previous" key.
 */

const LS_KEY_CURRENT = 'sim_log_current';
const LS_KEY_PREVIOUS = 'sim_log_previous';
const AUTO_SAVE_INTERVAL = 5;

function snapshotNpc(npc) {
  return {
    location: npc.location,
    hunger: Math.round(npc.hunger * 10) / 10,
    energy: Math.round(npc.energy * 10) / 10,
    currentSkill: npc.currentSkill,
    thought: npc.thought,
    shortTermGoal: npc.shortTermGoal || '',
    longTermGoal: npc.longTermGoal || '',
    memory: npc.memory.map(m => ({ hour: m.hour, text: m.text })),
    commitments: npc.commitments.map(c => ({ ...c })),
    daySummary: npc.daySummary || '',
  };
}

function snapshotInventories(itemSystem, npcIds, locationIds) {
  const out = {};
  for (const id of [...locationIds, ...npcIds]) {
    const inv = itemSystem.getInventory(id);
    const summary = {};
    for (const [itemId, val] of Object.entries(inv)) {
      if (Array.isArray(val)) {
        if (val.length > 0) summary[itemId] = val.length;
      } else if (val > 0) {
        summary[itemId] = val;
      }
    }
    if (Object.keys(summary).length > 0) out[id] = summary;
  }
  return out;
}

function fmtTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

class SimLoggerManager {
  constructor() {
    this._log = null;
    this._currentTick = null;
    this._tickCount = 0;
  }

  /** Call once on app start, before the first tick. */
  startSession(llmEnabled) {
    try {
      const prev = localStorage.getItem(LS_KEY_CURRENT);
      if (prev) localStorage.setItem(LS_KEY_PREVIOUS, prev);
      localStorage.removeItem(LS_KEY_CURRENT);
    } catch { /* noop */ }

    this._log = {
      meta: {
        startTime: new Date().toISOString(),
        endTime: null,
        totalTicks: 0,
        llmEnabled,
      },
      ticks: [],
    };
    this._tickCount = 0;

    if (this.hasPreviousLog()) {
      console.log('[SimLogger] Previous session log available — call SimLogger.downloadPrevious() to save it.');
    }
  }

  // ── Per-tick lifecycle ─────────────────────────────────

  /**
   * Start recording a tick. Called at the top of BehaviorSystem.tick()
   * AFTER needs have been applied (so npcsBefore reflects post-drain state).
   */
  beginTick({ day, hour, phase, ruinsRepair, sleeping, coldMultiplier }, npcs, itemSystem, npcIds, locationIds) {
    this._currentTick = {
      day,
      hour,
      phase: phase.nameCn,
      survivalPressure: phase.survivalPressure,
      ruinsRepair,
      sleeping,
      coldMultiplier,
      npcsBefore: {},
      npcsAfter: {},
      inventories: {},
      decisions: [],
      llmCalls: [],
      dialogues: [],
      consolidations: [],
      masteries: [],
    };

    for (const npc of npcs) {
      this._currentTick.npcsBefore[npc.id] = snapshotNpc(npc);
    }
    this._currentTick.inventories = snapshotInventories(itemSystem, npcIds, locationIds);
  }

  /** Log a rule-based or sleep decision. */
  logDecision(decision, source = 'rule') {
    if (!this._currentTick) return;
    this._currentTick.decisions.push({
      npc: decision.npc,
      skill: decision.skill,
      detail: decision.detail,
      source,
    });
  }

  /** Finalize the tick: snapshot NPC states after all sync decisions. Returns tick index. */
  endTick(npcs) {
    if (!this._currentTick || !this._log) return -1;
    for (const npc of npcs) {
      this._currentTick.npcsAfter[npc.id] = snapshotNpc(npc);
    }
    this._log.ticks.push(this._currentTick);
    const idx = this._log.ticks.length - 1;
    this._currentTick = null;
    this._tickCount++;
    if (this._tickCount % AUTO_SAVE_INTERVAL === 0) this._saveToStorage();
    return idx;
  }

  // ── Async append (LLM results come after endTick) ──────

  appendLLMCall(tickIdx, { type, locationId, prompt, rawResponse, parsed, error }) {
    const tick = this._log?.ticks[tickIdx];
    if (!tick) return;
    tick.llmCalls.push({
      type,
      locationId: locationId ?? null,
      prompt,
      rawResponse: rawResponse ?? null,
      parsed: parsed ?? null,
      error: error ? String(error) : null,
    });
  }

  appendDialogues(tickIdx, dialogues) {
    const tick = this._log?.ticks[tickIdx];
    if (!tick) return;
    tick.dialogues = dialogues;
  }

  /** Update npcsAfter when LLM overrides rule-based decisions. */
  updateAfterLLM(tickIdx, npcs) {
    const tick = this._log?.ticks[tickIdx];
    if (!tick) return;
    for (const npc of npcs) {
      tick.npcsAfter[npc.id] = snapshotNpc(npc);
    }
  }

  appendLLMDecisions(tickIdx, actions) {
    const tick = this._log?.ticks[tickIdx];
    if (!tick) return;
    for (const [npcId, decision] of actions) {
      tick.decisions.push({
        npc: npcId,
        skill: decision.skill,
        detail: decision.brief,
        location: decision.location,
        source: 'llm',
      });
    }
  }

  /**
   * 记录技能习得事件。可由 GameState.grantSkill 在任意时机调用；
   * 会附加到"当前正在记录的 tick"的 masteries 数组（若无正在进行的 tick，则附到最近一条）。
   */
  appendMastery({ npcId, npcName, skillId, skillNameCn }) {
    const entry = {
      npcId,
      npcName: npcName || npcId,
      skillId,
      skillNameCn: skillNameCn || skillId,
    };
    if (this._currentTick) {
      this._currentTick.masteries.push(entry);
      return;
    }
    if (this._log && this._log.ticks.length > 0) {
      const last = this._log.ticks[this._log.ticks.length - 1];
      if (!Array.isArray(last.masteries)) last.masteries = [];
      last.masteries.push(entry);
    }
  }

  appendConsolidation(tickIdx, { npcId, prompt, response, error }) {
    const tick = this._log?.ticks[tickIdx];
    if (!tick) return;
    tick.consolidations.push({
      npcId,
      prompt,
      response: response ?? null,
      error: error ? String(error) : null,
    });
  }

  /** Find the tick index for a given day+hour (for consolidation logging). */
  findTickIndex(day, hour) {
    if (!this._log) return -1;
    for (let i = this._log.ticks.length - 1; i >= 0; i--) {
      const t = this._log.ticks[i];
      if (t.day === day && t.hour === hour) return i;
    }
    return -1;
  }

  // ── Download / persistence ─────────────────────────────

  download() {
    if (!this._log || this._log.ticks.length === 0) {
      console.log('[SimLogger] No data to download.');
      return;
    }
    this._finalizeMeta();
    this._downloadJSON(this._log, `sim_log_${fmtTimestamp()}.json`);
  }

  downloadPrevious() {
    try {
      const raw = localStorage.getItem(LS_KEY_PREVIOUS);
      if (!raw) { console.log('[SimLogger] No previous session log found.'); return; }
      const parsed = JSON.parse(raw);
      this._downloadJSON(parsed, `sim_log_prev_${fmtTimestamp()}.json`);
    } catch (e) {
      console.warn('[SimLogger] Failed to download previous log:', e);
    }
  }

  saveBeforeUnload() {
    this._saveToStorage();
  }

  hasPreviousLog() {
    try { return !!localStorage.getItem(LS_KEY_PREVIOUS); } catch { return false; }
  }

  getTickCount() {
    return this._log ? this._log.ticks.length : 0;
  }

  // ── Internal ───────────────────────────────────────────

  _finalizeMeta() {
    if (!this._log) return;
    this._log.meta.endTime = new Date().toISOString();
    this._log.meta.totalTicks = this._log.ticks.length;
  }

  _saveToStorage() {
    try {
      if (!this._log || this._log.ticks.length === 0) return;
      this._finalizeMeta();
      localStorage.setItem(LS_KEY_CURRENT, JSON.stringify(this._log));
    } catch (e) {
      console.warn('[SimLogger] localStorage save failed:', e.message);
    }
  }

  _downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const SimLogger = new SimLoggerManager();
export default SimLogger;
