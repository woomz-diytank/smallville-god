import { getAllNpcProfilesForLLM, ACTIONS_BY_LOCATION } from '../data/npcProfiles.js';

export function buildDailyScriptPrompt(gameState) {
  const npcProfiles = getAllNpcProfilesForLLM();

  const actionsHelp = Object.entries(ACTIONS_BY_LOCATION)
    .map(([loc, actions]) => `  ${loc}: ${actions.join(', ')}`)
    .join('\n');

  return `You are the narrative director for a god simulation game. Generate a daily schedule/script for NPCs in a small town.

## World Context
A small town with these locations:
- Altar (祭坛): A sacred place for prayer and worship, tended by the devout
- Tavern (酒馆): A place for drinking, socializing, gambling, and gossip
- Plaza (广场): The town center where people meet, trade, and preach
- Forest (森林): A quiet place for hunting, foraging, gathering herbs, and solitude

## Available Actions by Location
${actionsHelp}

## NPC Profiles
${npcProfiles}

## Current Game State
- Day: ${gameState.day}
- Current Hour: ${gameState.currentHour}
- Remaining Hours Today: ${gameState.remainingHours}

Current NPC States:
${gameState.npcs.map(npc => `- ${npc.name}: at ${npc.location}, ${npc.currentAction}, faith=${npc.faith}`).join('\n')}

## Task
Generate a schedule for the remaining hours of the day (${gameState.currentHour} to 23). Each NPC should have believable, specific activities based on their personality and the location they're in.

## Output Format (JSON)
{
  "elara": [
    {"hour": ${gameState.currentHour}, "location": "altar", "action": "lighting_candles", "thought": "内心独白..."},
    ...
  ],
  "sly": [
    {"hour": ${gameState.currentHour}, "location": "tavern", "action": "drinking", "thought": "内心独白..."},
    ...
  ]
}

Rules:
- "location" must be one of: "altar", "tavern", "plaza", "forest"
- "action" must be from the Available Actions list for that location
- "thought" should be in Chinese, reflecting the NPC's personality (1-2 sentences)
- NPCs should not teleport erratically - transitions between locations should make sense
- Higher faith NPCs spend more time at altar doing religious activities
- Lower faith NPCs are more cynical and do secular activities
- Use varied, specific actions that match each NPC's role and personality
- Elara: prefers religious activities, cleaning, helping others, gathering herbs
- Sly: prefers drinking, gambling, hunting, trading, listening to gossip`;
}

export function buildOracleResponsePrompt(gameState, oracle) {
  const npcProfiles = getAllNpcProfilesForLLM();

  const actionsHelp = Object.entries(ACTIONS_BY_LOCATION)
    .map(([loc, actions]) => `  ${loc}: ${actions.join(', ')}`)
    .join('\n');

  const targetDesc = oracle.target === 'all'
    ? 'all NPCs in the town'
    : `specifically to ${oracle.target}`;

  return `You are the narrative director for a god simulation game. A divine oracle has been sent to the town.

## World Context
A small town with these locations:
- Altar (祭坛): A sacred place for prayer and worship
- Tavern (酒馆): A place for drinking, socializing, and gossip
- Plaza (广场): The town center where people meet and trade
- Forest (森林): A quiet place for hunting, foraging, and solitude

## Available Actions by Location
${actionsHelp}

## NPC Profiles
${npcProfiles}

## Current Game State
- Day: ${gameState.day}
- Current Hour: ${gameState.currentHour}
- Remaining Hours Today: ${gameState.remainingHours}

Current NPC States:
${gameState.npcs.map(npc => `- ${npc.name}: at ${npc.location}, ${npc.currentAction}, faith=${npc.faith}, memories: ${JSON.stringify(npc.recentMemories)}`).join('\n')}

## Divine Oracle
Type: ${oracle.type}
Target: ${targetDesc}
${oracle.type === 'message' ? `Message: "${oracle.message}"` : ''}
${oracle.type === 'holy_light' ? 'Effect: A brilliant holy light illuminates the entire town for a moment.' : ''}

## Task
Determine how each NPC interprets and reacts to this oracle. Consider:
1. Their personality and current faith level
2. How they would interpret the divine message/event
3. How it affects their faith (and why)
4. Their new schedule for the remaining hours (they might change plans!)

## Output Format (JSON)
{
  "reactions": {
    "elara": {
      "interpretation": "她对神谕的理解和反应 (1-2 sentences in Chinese)",
      "faithChange": "INCREASE|STRONG_INCREASE|SLIGHT_INCREASE|NEUTRAL|SLIGHT_DECREASE|DECREASE|STRONG_DECREASE",
      "newThought": "新的内心独白"
    },
    "sly": {
      "interpretation": "他对神谕的理解和反应",
      "faithChange": "...",
      "newThought": "..."
    }
  },
  "schedule": {
    "elara": [
      {"hour": ${gameState.currentHour}, "location": "...", "action": "...", "thought": "..."},
      ...remaining hours
    ],
    "sly": [...]
  }
}

Rules:
- Interpretations should reflect each NPC's unique personality
- A devout NPC (high faith) is more likely to interpret positively
- A cynical NPC (low faith) might be skeptical or dismissive
- The oracle might cause NPCs to dramatically change their plans
- Actions must be valid for the location (see Available Actions above)
- Faith changes should be justified by personality`;
}

export function buildInteractionPrompt(gameState, npc1Id, npc2Id) {
  return `Two NPCs are at the same location and may interact.

## NPCs Present
${gameState.npcs.filter(n => n.id === npc1Id || n.id === npc2Id).map(npc =>
  `- ${npc.name} (${npc.role}): faith=${npc.faith}, doing: ${npc.currentAction}`
).join('\n')}

## Task
Generate a brief interaction or observation between them.

## Output Format (JSON)
{
  "${npc1Id}": {
    "thought": "内心独白关于这次相遇",
    "faithChange": "NEUTRAL|SLIGHT_INCREASE|SLIGHT_DECREASE"
  },
  "${npc2Id}": {
    "thought": "内心独白关于这次相遇",
    "faithChange": "NEUTRAL|SLIGHT_INCREASE|SLIGHT_DECREASE"
  }
}`;
}
