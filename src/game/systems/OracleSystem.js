import { GAME_CONFIG, ORACLE_TYPES } from '../constants.js';
import GameState from '../GameState.js';
import GeminiClient from '../llm/GeminiClient.js';
import { buildOracleResponsePrompt } from '../llm/prompts.js';
import { parseOracleResponse, generateFallbackReaction } from '../llm/scriptParser.js';
import ScheduleSystem from './ScheduleSystem.js';

class OracleSystemManager {
  constructor() {
    this.onOracleProcessed = null;
  }

  init(callbacks = {}) {
    this.onOracleProcessed = callbacks.onOracleProcessed || (() => {});
  }

  async sendMessageOracle(message, target = 'all') {
    const cost = GAME_CONFIG.MESSAGE_COST;

    if (!GameState.consumePower(cost)) {
      return { success: false, reason: 'insufficient_power' };
    }

    const oracle = {
      type: ORACLE_TYPES.MESSAGE,
      message,
      target,
      timestamp: {
        day: GameState.get('time.day'),
        hour: GameState.get('time.hour')
      }
    };

    return this.processOracle(oracle);
  }

  async castHolyLight() {
    const cost = GAME_CONFIG.HOLY_LIGHT_COST;

    if (!GameState.consumePower(cost)) {
      return { success: false, reason: 'insufficient_power' };
    }

    const oracle = {
      type: ORACLE_TYPES.HOLY_LIGHT,
      target: 'all',
      timestamp: {
        day: GameState.get('time.day'),
        hour: GameState.get('time.hour')
      }
    };

    return this.processOracle(oracle);
  }

  async processOracle(oracle) {
    GameState.setLoading(true, GameState.t('processingOracle'));

    try {
      let reactions;
      let newSchedule;
      let llmSuccess = false;

      if (GeminiClient.isAvailable()) {
        // Use LLM to generate responses
        const gameState = ScheduleSystem.getCurrentStateForLLM();
        const prompt = buildOracleResponsePrompt(gameState, oracle);

        console.log('[OracleSystem] Sending prompt to LLM...');

        try {
          const llmResponse = await GeminiClient.generateJSON(prompt);
          console.log('[OracleSystem] LLM response received:', llmResponse);
          const parsed = parseOracleResponse(llmResponse);
          reactions = parsed.reactions;
          newSchedule = parsed.schedule;
          llmSuccess = true;
          console.log('[OracleSystem] LLM parsing successful');
        } catch (error) {
          console.error('[OracleSystem] LLM processing failed, using fallback:', error);
          reactions = this.generateFallbackReactions(oracle);
          newSchedule = null;
          llmSuccess = false;
        }
      } else {
        // Fallback mode without LLM
        console.log('[OracleSystem] LLM not available, using fallback');
        reactions = this.generateFallbackReactions(oracle);
        newSchedule = null;
        llmSuccess = false;
      }

      // Apply reactions to NPCs
      for (const [npcId, reaction] of Object.entries(reactions)) {
        const npc = GameState.getNpc(npcId);
        if (!npc) continue;

        // Skip if not targeted
        if (oracle.target !== 'all' && oracle.target !== npcId) continue;

        // Update NPC state
        GameState.updateNpc(npcId, {
          interpretation: reaction.interpretation,
          thought: reaction.newThought
        });

        // Apply faith change
        const currentFaith = npc.faith;
        const newFaith = Math.max(0, Math.min(100, currentFaith + reaction.faithChange));
        GameState.updateNpc(npcId, { faith: newFaith });

        // Add to memory
        npc.memory = npc.memory || [];
        npc.memory.push({
          type: 'oracle',
          oracleType: oracle.type,
          message: oracle.message || null,
          interpretation: reaction.interpretation,
          faithChange: reaction.faithChange,
          timestamp: oracle.timestamp
        });

        // Trim memory
        if (npc.memory.length > 10) {
          npc.memory = npc.memory.slice(-10);
        }
        GameState.updateNpc(npcId, { memory: npc.memory });
      }

      // Update schedule if LLM provided one
      if (newSchedule && Object.keys(newSchedule).length > 0) {
        ScheduleSystem.updateRemainingSchedule(newSchedule, GameState.get('time.hour'));
      }

      // Update global faith
      GameState.updateGlobalFaith();

      GameState.setLoading(false);

      console.log('[OracleSystem] Oracle processed, LLM success:', llmSuccess);
      this.onOracleProcessed(oracle, reactions, llmSuccess);

      return { success: true, reactions, usedLLM: llmSuccess };

    } catch (error) {
      console.error('Oracle processing error:', error);
      GameState.setLoading(false);
      return { success: false, reason: 'processing_error' };
    }
  }

  generateFallbackReactions(oracle) {
    const reactions = {};
    const npcs = GameState.getAllNpcs();

    for (const npc of npcs) {
      if (oracle.target !== 'all' && oracle.target !== npc.id) continue;
      reactions[npc.id] = generateFallbackReaction(npc, oracle.type);
    }

    return reactions;
  }

  canAfford(type) {
    const cost = type === ORACLE_TYPES.HOLY_LIGHT
      ? GAME_CONFIG.HOLY_LIGHT_COST
      : GAME_CONFIG.MESSAGE_COST;

    return GameState.get('divinePower.current') >= cost;
  }
}

export const OracleSystem = new OracleSystemManager();
export default OracleSystem;
