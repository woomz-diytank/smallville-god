import behaviorLibrary from '../data/behaviorLibrary.json';
import { TEXT_LIMIT } from '../config.js';

const VALID_LOCATIONS = new Set(Object.keys(behaviorLibrary.locations));

const ALL_SKILL_IDS = new Set();
for (const group of Object.values(behaviorLibrary.skills.PHYSICAL).flat()) {
  ALL_SKILL_IDS.add(group.id);
}
for (const s of behaviorLibrary.skills.SOCIAL) ALL_SKILL_IDS.add(s.id);
for (const s of behaviorLibrary.skills.MENTAL) ALL_SKILL_IDS.add(s.id);
for (const s of behaviorLibrary.skills.RESTORE) ALL_SKILL_IDS.add(s.id);
ALL_SKILL_IDS.add('practice');
ALL_SKILL_IDS.add('learn_from');

const NPC_IDS = new Set(Object.keys(behaviorLibrary.npcs));

const CN_TO_ID = new Map();
for (const [id, def] of Object.entries(behaviorLibrary.npcs)) {
  CN_TO_ID.set(def.nameCn, id);
}

/**
 * Parse and validate LLM output for a group tick.
 *
 * Expected input: { actions: [...], talks?: [...], commitments?: [...] }
 * Returns: { actions: Map<npcId, { location, skill, brief }>, talks: Array, commitments: Array }
 */
export function parseGroupResponse(llmResult, npcGroup) {
  const actions = new Map();
  const talks = [];
  const commitments = [];

  let actionList, talkList, commitList;
  if (Array.isArray(llmResult)) {
    actionList = llmResult;
    talkList = [];
    commitList = [];
  } else if (llmResult && typeof llmResult === 'object') {
    actionList = Array.isArray(llmResult.actions) ? llmResult.actions : [];
    talkList = Array.isArray(llmResult.talks) ? llmResult.talks : [];
    commitList = Array.isArray(llmResult.commitments) ? llmResult.commitments : [];
  } else {
    console.warn('[Parser] LLM result unexpected type:', typeof llmResult);
    return { actions, talks, commitments };
  }

  const groupNpcIds = new Set(npcGroup.map(n => n.id));
  const npcNameMap = new Map(npcGroup.map(n => [n.id, n.nameCn]));

  for (const entry of actionList) {
    if (!entry || typeof entry !== 'object') continue;

    const id = entry.id;
    if (!id || !NPC_IDS.has(id) || !groupNpcIds.has(id)) continue;

    // 使用 runtime NPC（含后天习得的技能），而不是静态的 behaviorLibrary.npcs[id]
    const runtimeNpc = npcGroup.find(n => n.id === id);
    if (!runtimeNpc) continue;
    const allNpcSkills = new Set([
      ...runtimeNpc.skills.PHYSICAL,
      ...runtimeNpc.skills.SOCIAL,
      ...runtimeNpc.skills.MENTAL,
      ...runtimeNpc.skills.RESTORE,
      'practice', 'learn_from',
    ]);

    const location = VALID_LOCATIONS.has(entry.loc) ? entry.loc : null;
    const skill = ALL_SKILL_IDS.has(entry.skill) && allNpcSkills.has(entry.skill)
      ? entry.skill : null;
    const brief = typeof entry.brief === 'string'
      ? entry.brief.slice(0, TEXT_LIMIT.BRIEF_MAX) : '';

    let target = null;
    if (skill === 'practice' || skill === 'learn_from') {
      if (typeof entry.target === 'string' && ALL_SKILL_IDS.has(entry.target)
          && entry.target !== 'practice' && entry.target !== 'learn_from') {
        target = entry.target;
      } else {
        console.warn(`[Parser] Learning action for ${id} missing/invalid target: ${entry.target}`);
        continue;
      }
    }

    if (location && skill) {
      actions.set(id, { location, skill, brief, target });
    } else {
      console.warn(`[Parser] Invalid entry for ${id}: loc=${entry.loc} skill=${entry.skill}`);
    }
  }

  for (const line of talkList) {
    if (!line || typeof line !== 'object') continue;
    let who = line.who;
    const say = typeof line.say === 'string' ? line.say.slice(0, TEXT_LIMIT.SAY_MAX) : '';
    if (!who || !say) continue;

    if (CN_TO_ID.has(who)) who = CN_TO_ID.get(who);
    if (!NPC_IDS.has(who)) continue;

    const speakerName = npcNameMap.get(who) || behaviorLibrary.npcs[who]?.nameCn || who;
    talks.push({ speaker: speakerName, speakerId: who, text: say });
  }

  for (const c of commitList) {
    if (!c || typeof c !== 'object') continue;
    const npcId = c.npc;
    if (!npcId || !NPC_IDS.has(npcId)) continue;
    const day = typeof c.day === 'number' ? c.day : null;
    if (!day) continue;
    const text = typeof c.text === 'string' ? c.text.slice(0, 30) : '';
    if (!text) continue;
    const withId = (c.with && NPC_IDS.has(c.with)) ? c.with : null;
    commitments.push({
      npc: npcId,
      day,
      hour: typeof c.hour === 'number' ? c.hour : null,
      text,
      with: withId,
    });
  }

  return { actions, talks, commitments };
}
