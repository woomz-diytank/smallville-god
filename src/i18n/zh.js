export default {
  title: '小镇之神',
  day: '第 {n} 天',
  faith: '信仰',
  power: '神力',
  oracle: '神谕',
  oraclePlaceholder: '输入神谕消息...',
  send: '发送',
  cost: '消耗',
  broadcast: '全体广播',

  // Controls
  pause: '暂停',
  play: '继续',
  speed: '速度',

  // NPC Panel
  thoughts: '内心想法',
  location: '位置',
  action: '动作',
  faithLevel: '信仰',

  // Locations
  locations: {
    altar: '祭坛',
    tavern: '酒馆',
    plaza: '广场',
    forest: '森林'
  },

  // NPCs
  npcs: {
    elara: {
      name: 'Elara',
      role: '修女',
      defaultThought: '主啊，请指引我的道路...'
    },
    sly: {
      name: 'Sly',
      role: '流浪者',
      defaultThought: '今天能找到什么好东西呢...'
    }
  },

  // Actions - 扩展的行为库
  actions: {
    // 通用行为
    sleeping: '休息中',
    wandering: '闲逛中',
    talking: '与人交谈',
    thinking: '陷入沉思',
    eating: '用餐中',
    resting: '休憩中',

    // 祭坛相关
    praying: '虔诚祈祷',
    meditating: '静心冥想',
    cleaning_altar: '打扫祭坛',
    lighting_candles: '点燃蜡烛',
    reading_scriptures: '诵读经文',
    blessing_visitors: '为访客祈福',
    arranging_offerings: '整理供品',
    polishing_statues: '擦拭神像',
    sweeping_temple: '清扫神殿',
    tending_incense: '照料香火',

    // 酒馆相关
    drinking: '独自饮酒',
    drinking_with_others: '与人对饮',
    bartending: '调酒招待',
    brewing_ale: '酿造麦酒',
    serving_customers: '招待客人',
    cleaning_mugs: '擦洗酒杯',
    listening_gossip: '打听消息',
    gambling: '赌博押注',
    arm_wrestling: '掰手腕比赛',
    telling_stories: '讲述故事',
    counting_coins: '数着铜板',
    mopping_floor: '拖地打扫',

    // 广场相关
    trading: '交易买卖',
    haggling: '讨价还价',
    people_watching: '观察路人',
    busking: '街头卖艺',
    preaching: '布道传教',
    begging: '乞讨',
    pickpocketing: '顺手牵羊',
    spreading_rumors: '散布流言',
    buying_supplies: '采购物资',
    selling_goods: '兜售货物',
    chatting_merchants: '与商贩闲聊',
    drawing_water: '打水',
    feeding_pigeons: '喂鸽子',

    // 森林相关
    gathering_herbs: '采集草药',
    chopping_wood: '砍伐木材',
    hunting: '打猎',
    foraging: '觅食采摘',
    setting_traps: '设置陷阱',
    collecting_firewood: '捡拾柴火',
    exploring_trails: '探索小径',
    hiding: '躲藏隐匿',
    napping_under_tree: '树下小憩',
    bird_watching: '观察鸟类',
    fishing: '溪边垂钓',
    meditating_nature: '在自然中冥想',
    carving_wood: '雕刻木头'
  },

  // Skills
  skills: {
    holyLight: {
      name: '神圣之光',
      description: '照亮整个小镇，提升所有人的信仰'
    }
  },

  // Loading
  loading: '神意降临中...',
  generatingScript: '生成今日剧本...',
  processingOracle: '处理神谕中...',

  // Game Over
  victory: '胜利！',
  defeat: '失败...',
  victoryMessage: '你成功获得了小镇居民的信仰！',
  defeatMessage: '小镇居民失去了对你的信仰...',
  restart: '重新开始',

  // Errors
  apiKeyMissing: '请在 .env.local 中设置 VITE_GEMINI_API_KEY',
  apiError: 'API 调用失败，请稍后重试'
};
