// Game Constants

export const GAME_CONFIG = {
  // Canvas dimensions
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 500,

  // Time settings
  HOURS_PER_DAY: 24,
  START_HOUR: 6,
  MS_PER_GAME_HOUR: 5000, // 5 seconds per game hour at 1x speed (24h = 120s)

  // Faith settings
  INITIAL_FAITH: 0,
  TARGET_FAITH: 100,
  MAX_FAITH: 150,
  MIN_FAITH: -50,

  // Divine power settings
  INITIAL_POWER: 50,
  MAX_POWER: 100,
  POWER_REGEN_PER_HOUR: 2,

  // Oracle costs
  MESSAGE_COST: 10,
  HOLY_LIGHT_COST: 20,

  // Speed options
  SPEED_OPTIONS: [1, 2, 4]
};

export const COLORS = {
  // UI Colors
  BACKGROUND: '#1a1a2e',
  PANEL_BG: 'rgba(30, 30, 50, 0.9)',
  GOLD: '#ffd700',
  LIGHT_BLUE: '#87ceeb',
  TEXT: '#e0e0e0',
  TEXT_MUTED: '#aaa',

  // Location Colors
  ALTAR: '#8b4513',
  TAVERN: '#4a3728',
  PLAZA: '#3d5c5c',
  FOREST: '#2d4a2d',

  // NPC Colors
  ELARA: '#f5f5dc',
  SLY: '#696969'
};

export const LOCATIONS = {
  altar: {
    id: 'altar',
    x: 50,
    y: 50,
    width: 320,
    height: 180,
    color: COLORS.ALTAR
  },
  tavern: {
    id: 'tavern',
    x: 430,
    y: 50,
    width: 320,
    height: 180,
    color: COLORS.TAVERN
  },
  plaza: {
    id: 'plaza',
    x: 50,
    y: 270,
    width: 320,
    height: 180,
    color: COLORS.PLAZA
  },
  forest: {
    id: 'forest',
    x: 430,
    y: 270,
    width: 320,
    height: 180,
    color: COLORS.FOREST
  }
};

export const FAITH_CHANGE = {
  STRONG_INCREASE: 15,
  INCREASE: 8,
  SLIGHT_INCREASE: 3,
  NEUTRAL: 0,
  SLIGHT_DECREASE: -3,
  DECREASE: -8,
  STRONG_DECREASE: -15
};

export const ORACLE_TYPES = {
  MESSAGE: 'message',
  HOLY_LIGHT: 'holy_light'
};
