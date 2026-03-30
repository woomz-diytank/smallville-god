import behaviorLibrary from '../data/behaviorLibrary.json';
import { THRESHOLD } from '../config.js';

const SKILL_NAMES = {};
for (const group of [...Object.values(behaviorLibrary.skills.PHYSICAL).flat()]) {
  SKILL_NAMES[group.id] = group.nameCn;
}
for (const s of behaviorLibrary.skills.SOCIAL) SKILL_NAMES[s.id] = s.nameCn;
for (const s of behaviorLibrary.skills.MENTAL) SKILL_NAMES[s.id] = s.nameCn;
for (const s of behaviorLibrary.skills.RESTORE) SKILL_NAMES[s.id] = s.nameCn;

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

/**
 * Build a prompt for one group of NPCs at the same location.
 * Designed to be concise: ~300-500 tokens input, expect ~100-200 tokens output.
 */
export function buildGroupPrompt({ npcs, locationId, itemSystem, hour, day, phase }) {
  const locDef = behaviorLibrary.locations[locationId];
  const locName = locDef.nameCn;
  const locItems = fmtItems(itemSystem, locationId);

  const npcLines = npcs.map(npc => {
    const n = behaviorLibrary.npcs[npc.id];
    const topNeed = Object.entries(n.needs)
      .sort((a, b) => b[1].weight - a[1].weight)[0];
    return `- [${npc.id}]${npc.nameCn}(${npc.age}岁): 会[${fmtSkills(npc)}] | ${fmtNeeds(npc)} | 性格:${n.personality.traits.slice(0, 2).join('、')} | 首要需求:${topNeed[0]}`;
  }).join('\n');

  const npcItems = npcs.map(npc => {
    const items = fmtItems(itemSystem, npc.id);
    return items !== '无' ? `  ${npc.nameCn}携带: ${items}` : null;
  }).filter(Boolean).join('\n');

  const storeItems = fmtItems(itemSystem, 'storehouse');

  const prompt = `你是一个中世纪生存模拟的导演。第${day}天 ${hour}:00，${phase.nameCn}，生存压力:${phase.survivalPressure}。

地点:${locName}，物资:[${locItems}]
仓库:[${storeItems}]
${npcItems ? '随身:\n' + npcItems : ''}

当前人物:
${npcLines}

为每人选择本小时的行为。规则:
1. 只能使用该人"会"列表中的技能
2. 需要工具的技能必须有对应工具（在随身或当前地点）
3. 可以移动到其他地点（square/chapel/forge/ruins/forest/storehouse）
4. 饱食度<${THRESHOLD.HUNGER_LOW}应优先进食（数值越低越饿）
5. 如果两人在一起，可以互动
${npcs.length >= 2 ? '6. 同一地点多人时，可能产生1-3句简短对话(符合人物性格)' : ''}
输出JSON对象(所有id用英文):
{"actions":[{"id":"aldric","loc":"forest","skill":"chop_wood","brief":"砍树备柴"}]${npcs.length >= 2 ? ',"talks":[{"who":"aldric","say":"这棵树够粗"},{"who":"erik","say":"小心点"}]' : ''}}
${npcs.length >= 2 ? 'talks可选，不需要每次都有。' : ''}`;

  return prompt;
}

/**
 * Build a prompt for a solo NPC (no group interaction).
 */
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
