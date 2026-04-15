import behaviorLibrary from '../data/behaviorLibrary.json';
import { THRESHOLD, BUILDING } from '../config.js';
import GameState from '../GameState.js';

function fmtSkills(npc) {
  const all = [
    ...npc.skills.PHYSICAL,
    ...npc.skills.SOCIAL,
    ...npc.skills.MENTAL,
  ];
  return all.join('/');
}

function fmtNeeds(npc) {
  return `饱食${Math.round(npc.hunger)} 体力${Math.round(npc.energy)}`;
}

function fmtItems(itemSystem, ownerId) {
  const inv = itemSystem.getInventory(ownerId);
  const parts = [];
  for (const [id, val] of Object.entries(inv)) {
    const def = itemSystem._registry.get(id);
    const name = def?.nameCn || id;
    if (Array.isArray(val)) {
      if (val.length > 0) parts.push(`${name}×${val.length}`);
    } else if (val > 0) {
      parts.push(`${name}×${val}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : '无';
}

function buildSurvivalContext(itemSystem, phase) {
  const tips = [];

  const ruinsProgress = GameState.state.ruinsRepairProgress;
  if (ruinsProgress < BUILDING.LABOR_HOURS) {
    tips.push('露天营地无法抵御严冬风雪，必须把废屋修成小屋。只有奥斯卡会build，但他只想砍柴囤木材，需要被说服。采集修缮材料(茅草forage、石块gather_stone)也需要人手协作。');
  }

  const furCoats = itemSystem.getQuantity('storehouse', 'fur_coat')
    + itemSystem.getQuantity('agnes', 'fur_coat')
    + itemSystem.getQuantity('roderic', 'fur_coat')
    + itemSystem.getQuantity('oskar', 'fur_coat');
  if (furCoats < 3) {
    const hides = itemSystem.getQuantity('storehouse', 'hide');
    tips.push(`过冬需要3件皮毛外套(现有${furCoats}件)。每件需兽皮×3，只有罗德里克能打猎获取兽皮并缝制衣物。现有兽皮${hides}张。罗德里克的弓耐久有限，每次狩猎都会消耗——得在弓断之前攒够皮毛。`);
  }

  const cookedMeat = itemSystem.getQuantity('storehouse', 'cooked_meat');
  const rawMeat = itemSystem.getQuantity('storehouse', 'raw_meat');
  const berries = itemSystem.getQuantity('storehouse', 'berries');
  if (phase.survivalPressure !== 'low' || cookedMeat < 5) {
    tips.push(`隆冬时森林极度危险，届时将无法狩猎采集，必须提前储备食物。当前库存：熟肉${cookedMeat}、生肉${rawMeat}(会腐烂，需尽快烹饪)、浆果${berries}。只有阿格尼丝能烹饪，罗德里克是唯一猎人。`);
  }

  const toolReport = itemSystem.getToolReport();
  const worn = toolReport
    .filter(t => !t.missing && t.current <= Math.ceil(t.max * 0.5))
    .map(t => `${t.nameCn}(${t.owner})耐久${t.current}/${t.max}`);
  const missing = toolReport
    .filter(t => t.missing)
    .map(t => t.nameCn);
  if (worn.length > 0 || missing.length > 0) {
    let toolTip = '奥斯卡可以在营地修理(repair_tool,消耗石块×1,恢复耐久+5)或重新制作工具(craft_tool,消耗材料较多)。';
    if (worn.length > 0) toolTip += `磨损警告：${worn.join('、')}。`;
    if (missing.length > 0) toolTip += `已损坏缺失：${missing.join('、')}，需要重新制作。`;
    tips.push(toolTip);
  }

  if (tips.length === 0) return '';
  return '\n【生存形势】' + tips.join(' ');
}

/**
 * @param mindContext - Map<npcId, { memoryStr, commitStr }> from MindSystem
 */
export function buildGroupPrompt({ npcs, locationId, itemSystem, hour, day, phase, mindContext }) {
  const locDef = behaviorLibrary.locations[locationId];
  const locName = locDef.nameCn;
  const locItems = fmtItems(itemSystem, locationId);

  const npcLines = npcs.map(npc => {
    const n = behaviorLibrary.npcs[npc.id];
    const traits = n.personality.traits.slice(0, 3).join('、');
    const values = n.personality.values.slice(0, 2).join('、');

    const mind = mindContext?.get(npc.id) || {};
    const memoryStr = mind.memoryStr || '';
    const commitStr = mind.commitStr || '(无)';

    let block = `- [${npc.id}]${npc.nameCn}(${npc.age}岁): 会[${fmtSkills(npc)}] | ${fmtNeeds(npc)}
  性格:${traits} | 看重:${values}`;

    if (npc.longTermGoal) block += `\n  长期目标: ${npc.longTermGoal}`;
    if (npc.shortTermGoal) block += `\n  近期目标: ${npc.shortTermGoal}`;
    if (commitStr !== '(无)') block += `\n  今日约定: ${commitStr}`;
    if (memoryStr) block += `\n  今天经历: ${memoryStr}`;

    return block;
  }).join('\n');

  const npcItems = npcs.map(npc => {
    const items = fmtItems(itemSystem, npc.id);
    return items !== '无' ? `  ${npc.nameCn}携带: ${items}` : null;
  }).filter(Boolean).join('\n');

  const storeItems = fmtItems(itemSystem, 'storehouse');

  const ruinsProgress = GameState.state.ruinsRepairProgress;
  const materialsReady = GameState.areMaterialsDelivered();
  let ruinsInfo;
  if (ruinsProgress >= BUILDING.LABOR_HOURS) {
    ruinsInfo = '废屋已修复为小屋';
  } else if (materialsReady) {
    ruinsInfo = `废屋修缮中：劳动进度${ruinsProgress}/${BUILDING.LABOR_HOURS}小时（材料已备齐）`;
  } else {
    const matDesc = Object.entries(BUILDING.MATERIALS).map(([id, qty]) => {
      const def = behaviorLibrary.items.consumable.find(i => i.id === id);
      return `${def?.nameCn || id}×${qty}`;
    }).join('+');
    ruinsInfo = `废屋待修缮：需先备齐材料(${matDesc})，再投入${BUILDING.LABOR_HOURS}小时劳动`;
  }

  const survivalContext = buildSurvivalContext(itemSystem, phase);

  const prompt = `你是一个中世纪生存模拟的导演。第${day}天 ${hour}:00，${phase.nameCn}，生存压力:${phase.survivalPressure}。

地点:${locName}，物资:[${locItems}]
仓库:[${storeItems}]
${ruinsInfo}${survivalContext}
${npcItems ? '随身:\n' + npcItems : ''}

当前人物:
${npcLines}

为每人决定这个小时做什么。规则:
1. 每人应根据自己的性格、目标、约定和当前处境独立决策
2. 只能使用该人"会"列表中的技能，需要工具的技能必须有对应工具
3. 可以移动到其他地点（camp/forest/ruins/storehouse）
4. 饱食度<${THRESHOLD.HUNGER_LOW}应优先进食，进食技能是eat，一次可以吃多份直到吃饱
5. 有约定时应优先履行约定
${npcs.length >= 2 ? `6. 同一地点有多人时，应自然地产生对话——打招呼、商量事情、表达想法、闲聊皆可，对话应反映角色性格
7. 如果对话中商定了未来的安排（如明天一起做某事），记录为commitment` : ''}
输出JSON:
{"actions":[{"id":"npc_id","loc":"location_id","skill":"skill_id","brief":"简述(15字内)"}]${npcs.length >= 2 ? ',"talks":[{"who":"npc_id","say":"台词"}],"commitments":[{"npc":"npc_id","day":2,"hour":8,"text":"约定内容","with":"other_id"}]' : ''}}
${npcs.length >= 2 ? 'talks鼓励产生——同地多人时几乎总会说点什么；commitments仅在明确约定未来安排时才需要。' : ''}`;

  return prompt;
}

export function buildConsolidationPrompt({ npc, npcDef, day, phase }) {
  const traits = npcDef.personality.traits.join('、');
  const values = npcDef.personality.values.join('、');
  const fears = npcDef.personality.fears.join('、');
  const bg = npcDef.background.slice(0, 100);

  const memoryLines = npc.memory.length > 0
    ? npc.memory.map(m => `- ${m.hour}:00 ${m.text}`).join('\n')
    : '- 没有特别的事发生';

  const prevContext = npc.daySummary
    ? `\n昨天回顾: ${npc.daySummary}` : '';

  return `你是${npc.nameCn}，${npc.age}岁。${bg}
性格: ${traits}。看重: ${values}。害怕: ${fears}。

第${day}天结束了，${phase.nameCn}，生存压力:${phase.survivalPressure}。${prevContext}

当前目标——近期: ${npc.shortTermGoal || '(无)'} | 长期: ${npc.longTermGoal || '(无)'}

今天做的事:
${memoryLines}

现在是睡前，回顾一天。请输出JSON:
{
  "daySummary": "用1-2句话总结今天（从你的视角）",
  "shortTermGoal": "接下来几天最想做的事（1句话）",
  "longTermGoal": "长远来看最重要的事（1句话）",
  "commitments": []
}
commitments只在今天和别人明确约好了什么事时才填写，格式: [{"day":${day + 1},"hour":8,"text":"内容","with":"npc_id"}]
大部分时候commitments为空数组。`;
}

export function buildSoloPrompt({ npc, locationId, itemSystem, hour, day, phase }) {
  return buildGroupPrompt({
    npcs: [npc],
    locationId,
    itemSystem,
    hour,
    day,
    phase,
  });
}
