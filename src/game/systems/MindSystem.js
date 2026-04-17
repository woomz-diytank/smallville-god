import behaviorLibrary from '../data/behaviorLibrary.json';
import GameState from '../GameState.js';
import GeminiClient from '../llm/GeminiClient.js';
import { buildConsolidationPrompt } from '../llm/prompts.js';
import { MIND, LLM, LEARNING } from '../config.js';
import SimLogger from './SimLogger.js';

const FALLBACK_GOALS = { short: '确保食物和燃料充足', long: '安全度过这个冬天' };

class MindSystemManager {
  init() {
    const npcs = GameState.getAllNpcs();
    for (const npc of npcs) {
      this._setInitialGoals(npc);
    }
    console.log('[MindSystem] Initialized goals for', npcs.length, 'NPCs');
  }

  _setInitialGoals(npc) {
    const def = behaviorLibrary.npcs[npc.id];
    if (!def) return;
    const goals = def.initialGoals || FALLBACK_GOALS;
    npc.shortTermGoal = goals.short;
    npc.longTermGoal = goals.long;
  }

  recordMemory(npc, hour, text) {
    npc.memory.push({ hour, text });
    if (npc.memory.length > MIND.MAX_MEMORY) {
      npc.memory.shift();
    }
  }

  addCommitment(npcId, commitment) {
    const npc = GameState.getNpc(npcId);
    if (!npc) return;
    npc.commitments.push(commitment);
    if (npc.commitments.length > MIND.MAX_COMMITMENTS) {
      npc.commitments.shift();
    }
  }

  getCommitmentsForHour(npc, day, hour) {
    return npc.commitments.filter(c =>
      c.day === day && (c.hour == null || c.hour === hour)
    );
  }

  clearExpiredCommitments(npc, day) {
    npc.commitments = npc.commitments.filter(c => c.day >= day);
  }

  /**
   * Sleep consolidation: summarize today, update goals.
   * Called once at NIGHT_START. Runs async per NPC.
   */
  async consolidateAll(day, phase, tickIdx) {
    this._consolidationTickIdx = tickIdx;
    const npcs = GameState.getAllNpcs();

    if (!GeminiClient.isAvailable()) {
      for (const npc of npcs) {
        this._ruleConsolidate(npc, day);
      }
      return;
    }

    const promises = npcs.map(npc => this._llmConsolidate(npc, day, phase));
    await Promise.allSettled(promises);
    GameState._notify();
  }

  /** 清空 NPC 的"今日已掌握"列表。应在新一天的第一个 tick 处理前调用。 */
  resetLearnedToday() {
    for (const npc of GameState.getAllNpcs()) {
      npc.learnedToday = [];
    }
  }

  /** 规则兜底：对进度 >= AUTO_MASTER_AT 的技能直接授予。 */
  _applyMasteryRule(npc) {
    const entries = Object.entries(npc.skillProgress || {});
    for (const [skillId, v] of entries) {
      if (v >= LEARNING.AUTO_MASTER_AT) {
        GameState.grantSkill(npc.id, skillId);
      }
    }
  }

  _ruleConsolidate(npc, day) {
    const texts = npc.memory.map(m => m.text);
    const summary = texts.length > 0
      ? `第${day}天：${texts.slice(0, 5).join('；')}`
      : `第${day}天：平静的一天`;

    if (npc.daySummary) {
      npc.pastSummaries.push({ day: day - 1, summary: npc.daySummary });
      if (npc.pastSummaries.length > MIND.MAX_PAST_SUMMARIES) {
        npc.pastSummaries.shift();
      }
    }
    npc.daySummary = summary;
    this._applyMasteryRule(npc);
    npc.memory = [];
    this.clearExpiredCommitments(npc, day + 1);
  }

  async _llmConsolidate(npc, day, phase) {
    const tickIdx = this._consolidationTickIdx;
    try {
      const def = behaviorLibrary.npcs[npc.id];
      const prompt = buildConsolidationPrompt({ npc, npcDef: def, day, phase });

      const result = await GeminiClient.generateJSON(prompt, {
        temperature: LLM.GROUP_TICK_TEMPERATURE,
        maxTokens: 512,
      });

      if (result.daySummary && typeof result.daySummary === 'string') {
        if (npc.daySummary) {
          npc.pastSummaries.push({ day: day - 1, summary: npc.daySummary });
          if (npc.pastSummaries.length > MIND.MAX_PAST_SUMMARIES) {
            npc.pastSummaries.shift();
          }
        }
        npc.daySummary = result.daySummary.slice(0, 80);
      }

      if (result.shortTermGoal && typeof result.shortTermGoal === 'string') {
        npc.shortTermGoal = result.shortTermGoal.slice(0, 40);
      }
      if (result.longTermGoal && typeof result.longTermGoal === 'string') {
        npc.longTermGoal = result.longTermGoal.slice(0, 40);
      }

      if (Array.isArray(result.masteredToday)) {
        for (const skillId of result.masteredToday) {
          if (typeof skillId !== 'string') continue;
          const progress = npc.skillProgress?.[skillId] || 0;
          if (progress >= LEARNING.BASE_THRESHOLD) {
            GameState.grantSkill(npc.id, skillId);
          }
        }
      }
      this._applyMasteryRule(npc);

      if (Array.isArray(result.commitments)) {
        for (const c of result.commitments) {
          if (!c || !c.text) continue;
          const commitment = {
            day: c.day || day + 1,
            hour: c.hour || null,
            text: String(c.text).slice(0, 30),
            with: c.with || null,
          };
          npc.commitments.push(commitment);

          if (c.with) {
            const other = GameState.getNpc(c.with);
            if (other) {
              other.commitments.push({
                ...commitment,
                with: npc.id,
              });
            }
          }
        }
      }

      npc.memory = [];
      this.clearExpiredCommitments(npc, day + 1);

      SimLogger.appendConsolidation(tickIdx, {
        npcId: npc.id,
        prompt,
        response: result,
        error: null,
      });

      console.log(`[MindSystem] Consolidated ${npc.nameCn}: "${npc.daySummary}"`);
    } catch (err) {
      SimLogger.appendConsolidation(tickIdx, {
        npcId: npc.id,
        prompt: '',
        response: null,
        error: err.message,
      });
      console.warn(`[MindSystem] Consolidation failed for ${npc.id}:`, err.message);
      this._ruleConsolidate(npc, day);
    }
  }

  fmtMemory(npc) {
    if (npc.memory.length === 0) return '';
    return npc.memory.map(m => `${m.hour}点${m.text}`).join('→');
  }

  fmtCommitments(npc, day) {
    const relevant = npc.commitments.filter(c => c.day >= day);
    if (relevant.length === 0) return '(无)';
    return relevant.map(c => {
      const timeStr = c.hour != null ? `第${c.day}天${c.hour}点` : `第${c.day}天`;
      const withStr = c.with ? `和${GameState.getNpc(c.with)?.nameCn || c.with}` : '';
      return `${timeStr}${withStr}${c.text}`;
    }).join('；');
  }
}

export const MindSystem = new MindSystemManager();
export default MindSystem;
