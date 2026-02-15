import { FAITH_CHANGE } from '../constants.js';
import { ALL_ACTIONS, ACTIONS_BY_LOCATION } from '../data/npcProfiles.js';

const VALID_LOCATIONS = ['altar', 'tavern', 'plaza', 'forest'];

/**
 * Parse and validate LLM-generated daily script
 */
export function parseDailyScript(llmResponse) {
  const parsed = {};

  for (const [npcId, schedule] of Object.entries(llmResponse)) {
    if (!Array.isArray(schedule)) continue;

    parsed[npcId] = schedule.map(entry => {
      const location = VALID_LOCATIONS.includes(entry.location) ? entry.location : 'plaza';
      const validActionsForLoc = ACTIONS_BY_LOCATION[location] || [];

      // Validate action is valid for this location, otherwise pick a default
      let action = entry.action;
      if (!validActionsForLoc.includes(action)) {
        // Try to find the action in ALL_ACTIONS (maybe wrong location)
        if (ALL_ACTIONS.includes(action)) {
          // Keep it anyway, just a minor mismatch
        } else {
          // Unknown action, pick a default for this location
          action = validActionsForLoc[0] || 'wandering';
        }
      }

      return {
        hour: Number(entry.hour),
        location,
        action,
        thought: entry.thought || '...'
      };
    }).filter(entry => entry.hour >= 0 && entry.hour < 24);
  }

  return parsed;
}

/**
 * Parse oracle response from LLM
 */
export function parseOracleResponse(llmResponse) {
  console.log('[scriptParser] Parsing oracle response:', llmResponse);

  const result = {
    reactions: {},
    schedule: {}
  };

  // Parse reactions
  if (llmResponse.reactions) {
    console.log('[scriptParser] Found reactions:', Object.keys(llmResponse.reactions));
    for (const [npcId, reaction] of Object.entries(llmResponse.reactions)) {
      result.reactions[npcId] = {
        interpretation: reaction.interpretation || '',
        innerConflict: reaction.innerConflict || '',
        faithChange: parseFaithChange(reaction.faithChange),
        newThought: reaction.newThought || ''
      };
      console.log(`[scriptParser] Parsed ${npcId}:`, result.reactions[npcId]);
    }
  } else {
    console.warn('[scriptParser] No reactions found in response');
  }

  // Parse schedule
  if (llmResponse.schedule) {
    result.schedule = parseDailyScript(llmResponse.schedule);
  }

  console.log('[scriptParser] Final parsed result:', result);
  return result;
}

/**
 * Convert faith change enum to numeric value
 */
export function parseFaithChange(changeStr) {
  const changeMap = {
    'STRONG_INCREASE': FAITH_CHANGE.STRONG_INCREASE,
    'INCREASE': FAITH_CHANGE.INCREASE,
    'SLIGHT_INCREASE': FAITH_CHANGE.SLIGHT_INCREASE,
    'NEUTRAL': FAITH_CHANGE.NEUTRAL,
    'SLIGHT_DECREASE': FAITH_CHANGE.SLIGHT_DECREASE,
    'DECREASE': FAITH_CHANGE.DECREASE,
    'STRONG_DECREASE': FAITH_CHANGE.STRONG_DECREASE
  };

  return changeMap[changeStr] ?? FAITH_CHANGE.NEUTRAL;
}

/**
 * Validate and sanitize NPC schedule entry
 */
export function validateScheduleEntry(entry) {
  const location = VALID_LOCATIONS.includes(entry.location) ? entry.location : 'plaza';
  const validActionsForLoc = ACTIONS_BY_LOCATION[location] || [];

  let action = entry.action;
  if (!validActionsForLoc.includes(action) && !ALL_ACTIONS.includes(action)) {
    action = validActionsForLoc[0] || 'wandering';
  }

  return {
    hour: Math.max(0, Math.min(23, Number(entry.hour) || 0)),
    location,
    action,
    thought: typeof entry.thought === 'string' ? entry.thought.slice(0, 200) : '...'
  };
}

/**
 * Generate fallback reaction when LLM fails
 */
export function generateFallbackReaction(npc, oracleType) {
  const isDevout = npc.faith > 50;

  if (oracleType === 'holy_light') {
    return {
      interpretation: isDevout
        ? '神圣的光芒！这是神明的恩赐！'
        : '那是什么光...可能只是天气变化吧。',
      faithChange: isDevout ? FAITH_CHANGE.INCREASE : FAITH_CHANGE.SLIGHT_INCREASE,
      newThought: isDevout ? '我感受到了神的存在...' : '奇怪的现象...'
    };
  }

  // Message oracle
  return {
    interpretation: isDevout
      ? '神明的话语传入我心...'
      : '又是那些神神叨叨的东西...',
    faithChange: isDevout ? FAITH_CHANGE.SLIGHT_INCREASE : FAITH_CHANGE.NEUTRAL,
    newThought: isDevout ? '我会铭记这启示...' : '不过是巧合罢了...'
  };
}
