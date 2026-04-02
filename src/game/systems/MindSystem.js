import behaviorLibrary from '../data/behaviorLibrary.json';
import GameState from '../GameState.js';
import GeminiClient from '../llm/GeminiClient.js';
import { buildConsolidationPrompt } from '../llm/prompts.js';
import { MIND, LLM } from '../config.js';
import SimLogger from './SimLogger.js';

const INITIAL_GOALS = {
  SURVIVE: { short: '确保食物和燃料充足', long: '安全度过这个冬天' },
  PRODUCE: { short: '做好手头的工作', long: '为营地建设贡献自己的手艺' },
  BOND:    { short: '关心身边的人', long: '让大家团结在一起不散伙' },
  SEEK:    { short: '弄清楚周围的环境和资源', long: '寻找让所有人长久活下去的办法' },
};

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
    const topNeedKey = Object.entries(def.needs)
      .sort((a, b) => b[1].weight - a[1].weight)[0][0];
    const goals = INITIAL_GOALS[topNeedKey] || INITIAL_GOALS.SURVIVE;
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
