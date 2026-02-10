export default {
  title: 'Smallville God',
  day: 'Day {n}',
  faith: 'Faith',
  power: 'Power',
  oracle: 'Oracle',
  oraclePlaceholder: 'Enter oracle message...',
  send: 'Send',
  cost: 'Cost',
  broadcast: 'Broadcast All',

  // Controls
  pause: 'Pause',
  play: 'Play',
  speed: 'Speed',

  // NPC Panel
  thoughts: 'Inner Thoughts',
  location: 'Location',
  action: 'Action',
  faithLevel: 'Faith',

  // Locations
  locations: {
    altar: 'Altar',
    tavern: 'Tavern',
    plaza: 'Plaza',
    forest: 'Forest'
  },

  // NPCs
  npcs: {
    elara: {
      name: 'Elara',
      role: 'Nun',
      defaultThought: 'Lord, please guide my path...'
    },
    sly: {
      name: 'Sly',
      role: 'Vagabond',
      defaultThought: 'Wonder what I can find today...'
    }
  },

  // Actions - Extended action library
  actions: {
    // General actions
    sleeping: 'Sleeping',
    wandering: 'Wandering around',
    talking: 'Chatting with someone',
    thinking: 'Lost in thought',
    eating: 'Having a meal',
    resting: 'Taking a rest',

    // Altar related
    praying: 'Praying devoutly',
    meditating: 'Meditating quietly',
    cleaning_altar: 'Cleaning the altar',
    lighting_candles: 'Lighting candles',
    reading_scriptures: 'Reading scriptures',
    blessing_visitors: 'Blessing visitors',
    arranging_offerings: 'Arranging offerings',
    polishing_statues: 'Polishing statues',
    sweeping_temple: 'Sweeping the temple',
    tending_incense: 'Tending the incense',

    // Tavern related
    drinking: 'Drinking alone',
    drinking_with_others: 'Drinking with company',
    bartending: 'Tending the bar',
    brewing_ale: 'Brewing ale',
    serving_customers: 'Serving customers',
    cleaning_mugs: 'Cleaning mugs',
    listening_gossip: 'Listening for gossip',
    gambling: 'Gambling',
    arm_wrestling: 'Arm wrestling',
    telling_stories: 'Telling stories',
    counting_coins: 'Counting coins',
    mopping_floor: 'Mopping the floor',

    // Plaza related
    trading: 'Trading goods',
    haggling: 'Haggling prices',
    people_watching: 'Watching people',
    busking: 'Street performing',
    preaching: 'Preaching',
    begging: 'Begging',
    pickpocketing: 'Pickpocketing',
    spreading_rumors: 'Spreading rumors',
    buying_supplies: 'Buying supplies',
    selling_goods: 'Selling goods',
    chatting_merchants: 'Chatting with merchants',
    drawing_water: 'Drawing water',
    feeding_pigeons: 'Feeding pigeons',

    // Forest related
    gathering_herbs: 'Gathering herbs',
    chopping_wood: 'Chopping wood',
    hunting: 'Hunting',
    foraging: 'Foraging',
    setting_traps: 'Setting traps',
    collecting_firewood: 'Collecting firewood',
    exploring_trails: 'Exploring trails',
    hiding: 'Hiding',
    napping_under_tree: 'Napping under a tree',
    bird_watching: 'Bird watching',
    fishing: 'Fishing by the stream',
    meditating_nature: 'Meditating in nature',
    carving_wood: 'Carving wood'
  },

  // Skills
  skills: {
    holyLight: {
      name: 'Holy Light',
      description: 'Illuminate the town, boost everyone\'s faith'
    }
  },

  // Loading
  loading: 'Divine presence descending...',
  generatingScript: 'Generating daily script...',
  processingOracle: 'Processing oracle...',

  // Game Over
  victory: 'Victory!',
  defeat: 'Defeat...',
  victoryMessage: 'You have gained the faith of the townspeople!',
  defeatMessage: 'The townspeople have lost faith in you...',
  restart: 'Restart',

  // Errors
  apiKeyMissing: 'Please set VITE_GEMINI_API_KEY in .env.local',
  apiError: 'API call failed, please try again'
};
