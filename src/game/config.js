/**
 * 游戏数值配置中心
 * 所有可调数值集中在此，方便平衡性调整。
 */

// ─── 时间 ───────────────────────────────────────────
export const TIME = {
  HOURS_PER_DAY: 24,
  START_HOUR: 6,           // 第一天模拟开始的小时
  DAYS_PER_WEEK: 7,
  MS_PER_HOUR: 20_000,     // 现实毫秒 / 游戏小时（1× 速度下）
  SPEED_OPTIONS: [1, 2, 4, 8],
  NIGHT_START: 22,         // ≥ 此小时进入睡眠
  NIGHT_END: 5,            // < 此小时仍视为夜晚
};

// ─── NPC 初始属性 ────────────────────────────────────
// hunger: 100=吃饱, 0=饥饿  |  energy: 100=精力充沛, 0=筋疲力尽
export const INITIAL_STATS = {
  HUNGER: 80,
  ENERGY: 80,
};

// ─── 每小时需求消耗 ──────────────────────────────────
export const NEEDS = {
  HUNGER_DRAIN_PER_HOUR: 6,        // 每小时饱食度下降
  HUNGER_DRAIN_SLEEP: 2,           // 睡眠时饱食度下降（比清醒时慢）
  ENERGY_DRAIN_PER_HOUR: 2,        // 每小时体力自然下降
  ENERGY_DRAIN_LOW_HUNGER: 3,      // 饥饿时额外体力下降（叠加）
};

// ─── 环境温度倍率 ────────────────────────────────────
// 由 winterPhase.survivalPressure 决定，乘以基础消耗
export const ENV_TEMPERATURE = {
  low: 1.0,
  moderate: 1.3,
  high: 1.6,
  extreme: 2.0,
  DEFAULT: 1.0,
};

// ─── 能量消耗（按行为类型） ──────────────────────────
export const ENERGY_COST = {
  PHYSICAL: 5,
  SOCIAL: 2,
  MENTAL: 1,
};

// ─── 恢复量 ─────────────────────────────────────────
export const RECOVERY = {
  SLEEP_ENERGY: 15,        // 每小时睡眠恢复体力

  // 进食恢复饱食度（规则路径 - 按食物类型）
  EAT_RESTORE: {
    cooked_meat: 40,
    raw_meat: 20,
    berries: 15,
  },

  // LLM 路径下的固定恢复
  LLM_EAT_HUNGER: 30,     // eat 技能加饱食度
  LLM_REST_ENERGY: 10,    // rest/sleep 技能加体力
};

// ─── 决策阈值 ───────────────────────────────────────
export const THRESHOLD = {
  ENERGY_LOW: 15,          // 体力低于此值 → 强制休息
  HUNGER_LOW: 25,          // 饱食度低于此值 → 优先进食
  HUNGER_ENERGY_PENALTY: 30, // 饱食度低于此值 → 体力加速下降
};

// ─── 采集 / 制作效率 ────────────────────────────────
export const GATHER = {
  YIELD_PER_SKILL: 1,      // 每次执行技能产出的物资数量
  CONSUME_PER_SKILL: 1,    // 每次执行技能消耗的材料数量
  EAT_CONSUME: 1,          // 进食消耗食物数量
};

// ─── 开局物资 ────────────────────────────────────────
export const STARTING_ITEMS = {
  npc: [
    { owner: 'aldric',  item: 'hammer' },
    { owner: 'roderic', item: 'bow' },
    { owner: 'roderic', item: 'hunting_knife' },
    { owner: 'erik',    item: 'axe' },
    { owner: 'oskar',   item: 'saw' },
    { owner: 'ingrid',  item: 'needle_thread' },
  ],
  location: [
    { owner: 'storehouse', item: 'cooking_pot', qty: 1 },
    { owner: 'storehouse', item: 'berries',     qty: 12 },
    { owner: 'storehouse', item: 'raw_meat',    qty: 6 },
    { owner: 'storehouse', item: 'timber',      qty: 8 },
    { owner: 'storehouse', item: 'thatch',      qty: 4 },
    { owner: 'storehouse', item: 'scrap_metal', qty: 3 },
    { owner: 'ruins',      item: 'stone',       qty: 5 },
    { owner: 'forest',     item: 'snare',       qty: 1 },
  ],
};

// ─── LLM 参数 ───────────────────────────────────────
export const LLM = {
  DEFAULT_TEMPERATURE: 0.8,
  DEFAULT_MAX_TOKENS: 8192,
  DEFAULT_TOP_P: 0.9,
  GROUP_TICK_TEMPERATURE: 0.7,
  GROUP_TICK_MAX_TOKENS: 2048,
  JSON_DEFAULT_MAX_TOKENS: 2048,
};

// ─── 文本截断 ───────────────────────────────────────
export const TEXT_LIMIT = {
  BRIEF_MAX: 20,           // NPC 行为摘要最大字符
  SAY_MAX: 50,             // 对话单句最大字符
};

// ─── UI / 日志 ──────────────────────────────────────
export const UI = {
  MAX_LOG_ENTRIES: 100,     // 内存中保留的日志条数
  DISPLAY_LOG_LINES: 30,   // 非回放模式下显示的日志行数
};

// ─── 统一上下限 ─────────────────────────────────────
export const STAT_BOUNDS = {
  MIN: 0,
  MAX: 100,
};
