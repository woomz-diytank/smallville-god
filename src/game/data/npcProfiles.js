// NPC Profile Data for LLM Context

// Available actions by location
export const ACTIONS_BY_LOCATION = {
  altar: [
    'praying', 'meditating', 'cleaning_altar', 'lighting_candles',
    'reading_scriptures', 'blessing_visitors', 'arranging_offerings',
    'polishing_statues', 'sweeping_temple', 'tending_incense',
    'sleeping', 'thinking', 'talking'
  ],
  tavern: [
    'drinking', 'drinking_with_others', 'bartending', 'brewing_ale',
    'serving_customers', 'cleaning_mugs', 'listening_gossip', 'gambling',
    'arm_wrestling', 'telling_stories', 'counting_coins', 'mopping_floor',
    'sleeping', 'eating', 'talking', 'resting'
  ],
  plaza: [
    'trading', 'haggling', 'people_watching', 'busking', 'preaching',
    'begging', 'pickpocketing', 'spreading_rumors', 'buying_supplies',
    'selling_goods', 'chatting_merchants', 'drawing_water', 'feeding_pigeons',
    'wandering', 'talking', 'thinking'
  ],
  forest: [
    'gathering_herbs', 'chopping_wood', 'hunting', 'foraging',
    'setting_traps', 'collecting_firewood', 'exploring_trails', 'hiding',
    'napping_under_tree', 'bird_watching', 'fishing', 'meditating_nature',
    'carving_wood', 'wandering', 'resting'
  ]
};

// All valid actions (flattened)
export const ALL_ACTIONS = [...new Set(Object.values(ACTIONS_BY_LOCATION).flat())];

export const NPC_PROFILES = {
  elara: {
    id: 'elara',
    name: 'Elara',
    role: 'Nun',
    color: '#f5f5dc',
    initialLocation: 'altar',
    initialAction: 'praying',
    initialFaith: 80,
    personality: {
      traits: ['devout', 'pious', 'clean-freak', 'kind-hearted', 'traditional'],
      values: ['faith', 'cleanliness', 'order', 'helping others'],
      fears: ['losing faith', 'chaos', 'uncleanliness'],
      quirks: ['always tidying things', 'mutters prayers when nervous']
    },
    // Actions this NPC would typically do (weighted by preference)
    preferredActions: {
      altar: ['praying', 'meditating', 'cleaning_altar', 'lighting_candles', 'reading_scriptures', 'tending_incense', 'polishing_statues', 'blessing_visitors'],
      tavern: ['talking', 'eating'],
      plaza: ['preaching', 'buying_supplies', 'drawing_water', 'feeding_pigeons', 'chatting_merchants'],
      forest: ['gathering_herbs', 'meditating_nature', 'bird_watching']
    },
    background: `Elara has served at the altar since she was young. She finds peace in routine
and prayer. Though deeply devoted, she sometimes questions if her prayers are heard.
She keeps the altar and surrounding areas spotlessly clean. She is kind to travelers
and the poor, often sharing food with those in need. She gathers herbs from the forest
to make remedies for the sick.`,
    relationships: {
      sly: 'Sees him as a lost soul who needs guidance. Wishes he would visit the altar more.'
    },
    dailyRoutine: {
      6: { location: 'altar', action: 'lighting_candles' },
      7: { location: 'altar', action: 'praying' },
      8: { location: 'altar', action: 'cleaning_altar' },
      9: { location: 'altar', action: 'sweeping_temple' },
      10: { location: 'plaza', action: 'buying_supplies' },
      11: { location: 'plaza', action: 'preaching' },
      12: { location: 'altar', action: 'eating' },
      13: { location: 'altar', action: 'reading_scriptures' },
      14: { location: 'forest', action: 'gathering_herbs' },
      15: { location: 'plaza', action: 'blessing_visitors' },
      16: { location: 'altar', action: 'arranging_offerings' },
      17: { location: 'altar', action: 'tending_incense' },
      18: { location: 'altar', action: 'polishing_statues' },
      19: { location: 'altar', action: 'meditating' },
      20: { location: 'altar', action: 'praying' },
      21: { location: 'altar', action: 'reading_scriptures' },
      22: { location: 'altar', action: 'sleeping' },
      23: { location: 'altar', action: 'sleeping' },
      0: { location: 'altar', action: 'sleeping' },
      1: { location: 'altar', action: 'sleeping' },
      2: { location: 'altar', action: 'sleeping' },
      3: { location: 'altar', action: 'sleeping' },
      4: { location: 'altar', action: 'sleeping' },
      5: { location: 'altar', action: 'praying' }
    }
  },

  sly: {
    id: 'sly',
    name: 'Sly',
    role: 'Vagabond',
    color: '#696969',
    initialLocation: 'tavern',
    initialAction: 'drinking',
    initialFaith: 20,
    personality: {
      traits: ['cynical', 'streetwise', 'opportunistic', 'secretly lonely', 'witty'],
      values: ['freedom', 'survival', 'self-reliance'],
      fears: ['commitment', 'being vulnerable', 'trusting others'],
      quirks: ['always has a sarcastic comment', 'picks up shiny objects', 'knows everyone\'s secrets']
    },
    // Actions this NPC would typically do
    preferredActions: {
      altar: ['thinking', 'hiding'],
      tavern: ['drinking', 'drinking_with_others', 'gambling', 'listening_gossip', 'telling_stories', 'arm_wrestling', 'counting_coins'],
      plaza: ['people_watching', 'pickpocketing', 'spreading_rumors', 'haggling', 'selling_goods'],
      forest: ['setting_traps', 'hunting', 'foraging', 'hiding', 'napping_under_tree', 'fishing', 'carving_wood']
    },
    background: `Sly arrived in town years ago and never left. He survives by doing odd jobs,
occasionally gambling, and knowing everyone's business. He acts tough but deep down
craves connection. He doesn't trust easily but respects those who prove themselves.
He's seen enough hardship to be skeptical of divine promises. He hunts and forages
in the forest to survive, and trades goods in the plaza when he has something valuable.`,
    relationships: {
      elara: 'Secretly respects her conviction but thinks religion is a crutch for the weak.'
    },
    dailyRoutine: {
      6: { location: 'tavern', action: 'sleeping' },
      7: { location: 'tavern', action: 'sleeping' },
      8: { location: 'tavern', action: 'sleeping' },
      9: { location: 'tavern', action: 'eating' },
      10: { location: 'tavern', action: 'drinking' },
      11: { location: 'plaza', action: 'people_watching' },
      12: { location: 'plaza', action: 'haggling' },
      13: { location: 'forest', action: 'setting_traps' },
      14: { location: 'forest', action: 'hunting' },
      15: { location: 'forest', action: 'foraging' },
      16: { location: 'plaza', action: 'selling_goods' },
      17: { location: 'tavern', action: 'drinking' },
      18: { location: 'tavern', action: 'listening_gossip' },
      19: { location: 'tavern', action: 'gambling' },
      20: { location: 'tavern', action: 'drinking_with_others' },
      21: { location: 'tavern', action: 'telling_stories' },
      22: { location: 'tavern', action: 'drinking' },
      23: { location: 'tavern', action: 'counting_coins' },
      0: { location: 'tavern', action: 'sleeping' },
      1: { location: 'tavern', action: 'sleeping' },
      2: { location: 'tavern', action: 'sleeping' },
      3: { location: 'tavern', action: 'sleeping' },
      4: { location: 'tavern', action: 'sleeping' },
      5: { location: 'tavern', action: 'sleeping' }
    }
  }
};

export function getNpcProfileForLLM(npcId) {
  const profile = NPC_PROFILES[npcId];
  if (!profile) return null;

  return `
## ${profile.name} (${profile.role})

**Personality Traits:** ${profile.personality.traits.join(', ')}
**Values:** ${profile.personality.values.join(', ')}
**Fears:** ${profile.personality.fears.join(', ')}
**Quirks:** ${profile.personality.quirks.join(', ')}

**Preferred Actions:**
- At Altar: ${profile.preferredActions.altar.join(', ')}
- At Tavern: ${profile.preferredActions.tavern.join(', ')}
- At Plaza: ${profile.preferredActions.plaza.join(', ')}
- At Forest: ${profile.preferredActions.forest.join(', ')}

**Background:**
${profile.background}
  `.trim();
}

export function getAllNpcProfilesForLLM() {
  return Object.keys(NPC_PROFILES)
    .map(id => getNpcProfileForLLM(id))
    .join('\n\n---\n\n');
}

export function getActionsForLocation(locationId) {
  return ACTIONS_BY_LOCATION[locationId] || ['wandering', 'thinking'];
}

export default NPC_PROFILES;
