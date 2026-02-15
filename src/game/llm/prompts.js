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
- "thought" should be SHORT Chinese text (10-15 characters max), like "今天天气不错" or "有点累了"
- NPCs should not teleport erratically - transitions between locations should make sense
- Higher faith NPCs spend more time at altar doing religious activities
- Lower faith NPCs are more cynical and do secular activities
- Elara: prefers religious activities, cleaning, helping others, gathering herbs
- Sly: prefers drinking, gambling, hunting, trading, listening to gossip
- Keep responses concise to avoid truncation`;
}

export function buildOracleResponsePrompt(gameState, oracle) {
  const npcProfiles = getAllNpcProfilesForLLM();

  const actionsHelp = Object.entries(ACTIONS_BY_LOCATION)
    .map(([loc, actions]) => `  ${loc}: ${actions.join(', ')}`)
    .join('\n');

  const targetDesc = oracle.target === 'all'
    ? 'all NPCs in the town'
    : `specifically to ${oracle.target}`;

  // Format memories for better context
  const formatMemories = (memories) => {
    if (!memories || memories.length === 0) return '无';
    return memories.map(m => {
      if (m.type === 'oracle') {
        return `[第${m.timestamp?.day || '?'}天] 收到神谕: "${m.message || '神圣之光'}" → 理解为: "${m.interpretation}" (信仰${m.faithChange > 0 ? '+' : ''}${m.faithChange})`;
      }
      return JSON.stringify(m);
    }).join('\n    ');
  };

  return `你是一个神灵模拟游戏的叙事导演。一道神谕刚刚降临小镇。

## 世界背景
一个宁静的小镇，有以下地点：
- 祭坛 (altar): 神圣的祈祷和礼拜之地
- 酒馆 (tavern): 饮酒、社交和八卦的场所
- 广场 (plaza): 人们交易、聚会和布道的中心
- 森林 (forest): 狩猎、采集和独处的幽静之所

## 各地点可用行为
${actionsHelp}

## NPC 详细档案
${npcProfiles}

## 当前游戏状态
- 第 ${gameState.day} 天
- 当前时间: ${gameState.currentHour}:00
- 今日剩余时间: ${gameState.remainingHours} 小时

各 NPC 当前状态:
${gameState.npcs.map(npc => `
### ${npc.name} (信仰值: ${npc.faith}/100)
- 位置: ${npc.location}
- 正在: ${npc.currentAction}
- 过往神谕经历:
    ${formatMemories(npc.recentMemories)}`).join('\n')}

## 本次神谕
类型: ${oracle.type === 'message' ? '神谕消息' : '神圣之光'}
目标: ${targetDesc === 'all NPCs in the town' ? '全体居民' : oracle.target}
${oracle.type === 'message' ? `内容: "${oracle.message}"` : ''}
${oracle.type === 'holy_light' ? '效果: 一道耀眼的神圣光芒瞬间照亮了整个小镇。' : ''}

## 任务
请深入刻画每个 NPC 对神谕的反应。这不是简单的"相信/不相信"，而是复杂的内心活动。

### 心理刻画要点：
1. **个人历史关联**: 这次神谕是否让他们想起了过去的经历？与之前的神谕有何联系？
2. **内心冲突**: 他们的理性与感性如何博弈？有没有想相信却不敢相信，或想否认却无法忽视的矛盾？
3. **性格驱动**: 根据他们的性格特点（恐惧、价值观、怪癖），他们会有什么独特反应？
4. **情感层次**: 展现复杂情感——惊讶、怀疑、希望、恐惧、感动、困惑、释然等
5. **行为改变**: 这次神谕会如何影响他们接下来的行动和计划？

### 角色特殊考量：
- **Elara (修女)**: 她虔诚但内心也有疑虑。神谕是否回应了她的祈祷？是否让她更坚定还是产生新的困惑？她可能会联系到她照顾的病人、采集的草药、对 Sly 的担忧等。
- **Sly (流浪者)**: 他愤世嫉俗但内心渴望归属。神谕是否触动了他隐藏的柔软面？他会用什么借口来否认被触动？他的讽刺背后藏着什么？

## 输出格式 (JSON)
{
  "reactions": {
    "elara": {
      "interpretation": "她对神谕的第一反应和理解（2-3句，展现即时的情感冲击）",
      "innerConflict": "她内心的挣扎或思考（1-2句，展现复杂性）",
      "faithChange": "INCREASE|STRONG_INCREASE|SLIGHT_INCREASE|NEUTRAL|SLIGHT_DECREASE|DECREASE|STRONG_DECREASE",
      "newThought": "她现在脑海中萦绕的想法（1句，可以是疑问、决心、感慨等）"
    },
    "sly": {
      "interpretation": "...",
      "innerConflict": "...",
      "faithChange": "...",
      "newThought": "..."
    }
  },
  "schedule": {
    "elara": [
      {"hour": ${gameState.currentHour}, "location": "...", "action": "...", "thought": "此刻的内心独白"},
      ...剩余小时
    ],
    "sly": [...]
  }
}

## 重要规则
- 所有文本内容必须使用中文
- interpretation 要有情感温度，不要干巴巴的陈述
- innerConflict 要展现人物的复杂性和深度
- 高信仰者也可能有困惑，低信仰者也可能被触动
- 神谕可能导致 NPC 大幅改变原有计划
- location 必须是: altar, tavern, plaza, forest 之一
- action 必须来自对应地点的可用行为列表`;
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
