import { GAME_CONFIG, ORACLE_TYPES } from '../constants.js';
import GameState from '../GameState.js';
import OracleSystem from '../systems/OracleSystem.js';
import Renderer from '../Renderer.js';

class OraclePanelManager {
  constructor() {
    this.elements = {};
    this.activeSkill = null;
  }

  init() {
    this.elements = {
      input: document.getElementById('oracle-input'),
      sendBtn: document.getElementById('oracle-send'),
      targetSelect: document.getElementById('oracle-target'),
      holyLightBtn: document.getElementById('skill-light'),
      costDisplay: document.getElementById('oracle-cost')
    };

    this.bindEvents();
    this.updateUI();

    // Subscribe to state changes
    GameState.subscribe((path) => {
      if (path === 'divinePower' || path.startsWith('divinePower')) {
        this.updateUI();
      }
    });
  }

  bindEvents() {
    // Send message oracle
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());

    // Enter key to send
    this.elements.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Holy light skill
    this.elements.holyLightBtn.addEventListener('click', () => this.castHolyLight());

    // Update cost display on target change
    this.elements.targetSelect.addEventListener('change', () => this.updateCostDisplay());
  }

  async sendMessage() {
    const message = this.elements.input.value.trim();
    if (!message) return;

    const target = this.elements.targetSelect.value;

    if (!OracleSystem.canAfford(ORACLE_TYPES.MESSAGE)) {
      this.showError(GameState.t('insufficientPower') || '神力不足');
      return;
    }

    // Disable input during processing
    this.setInputEnabled(false);

    const result = await OracleSystem.sendMessageOracle(message, target);

    this.setInputEnabled(true);

    if (result.success) {
      this.elements.input.value = '';
      this.showReactions(result.reactions);
    } else {
      this.showError(result.reason);
    }

    this.updateUI();
  }

  async castHolyLight() {
    if (!OracleSystem.canAfford(ORACLE_TYPES.HOLY_LIGHT)) {
      this.showError(GameState.t('insufficientPower') || '神力不足');
      return;
    }

    // Visual effect
    this.elements.holyLightBtn.classList.add('active');
    await Renderer.drawHolyLightEffect();
    this.elements.holyLightBtn.classList.remove('active');

    const result = await OracleSystem.castHolyLight();

    if (result.success) {
      this.showReactions(result.reactions);
    } else {
      this.showError(result.reason);
    }

    this.updateUI();
  }

  updateUI() {
    const power = GameState.get('divinePower.current');

    // Update button states
    this.elements.sendBtn.disabled = power < GAME_CONFIG.MESSAGE_COST;
    this.elements.holyLightBtn.disabled = power < GAME_CONFIG.HOLY_LIGHT_COST;

    // Update cost display
    this.updateCostDisplay();
  }

  updateCostDisplay() {
    const cost = GAME_CONFIG.MESSAGE_COST;
    this.elements.costDisplay.textContent = `${GameState.t('cost')}: ${cost} ${GameState.t('power')}`;
  }

  setInputEnabled(enabled) {
    this.elements.input.disabled = !enabled;
    this.elements.sendBtn.disabled = !enabled;
    this.elements.targetSelect.disabled = !enabled;
    this.elements.holyLightBtn.disabled = !enabled;
  }

  showReactions(reactions) {
    // Update NPC panel if one is selected
    const selectedId = GameState.get('selectedNpc');
    if (selectedId && reactions[selectedId]) {
      // The NPC panel will update automatically through state subscription
    }
  }

  showError(reason) {
    console.warn('Oracle error:', reason);
    // Could add toast notification here
  }

  updateTargetOptions() {
    const select = this.elements.targetSelect;
    const npcs = GameState.getAllNpcs();

    // Clear existing NPC options (keep "all" option)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Add NPC options
    for (const npc of npcs) {
      const option = document.createElement('option');
      option.value = npc.id;
      option.textContent = npc.name;
      select.appendChild(option);
    }
  }
}

export const OraclePanel = new OraclePanelManager();
export default OraclePanel;
