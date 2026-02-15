import './style.css';
import GameState from './game/GameState.js';
import Renderer from './game/Renderer.js';
import TimeSystem from './game/systems/TimeSystem.js';
import ScheduleSystem from './game/systems/ScheduleSystem.js';
import OracleSystem from './game/systems/OracleSystem.js';
import GeminiClient from './game/llm/GeminiClient.js';
import { buildDailyScriptPrompt } from './game/llm/prompts.js';
import { parseDailyScript } from './game/llm/scriptParser.js';
import NPCPanel from './game/ui/NPCPanel.js';
import OraclePanel from './game/ui/OraclePanel.js';
import MessageLog from './game/ui/MessageLog.js';

class Game {
  constructor() {
    this.elements = {};
    this.animationId = null;
  }

  async init() {
    // Cache DOM elements
    this.elements = {
      title: document.getElementById('game-title'),
      dayDisplay: document.getElementById('day-display'),
      hourDisplay: document.getElementById('hour-display'),
      faithBar: document.getElementById('faith-bar'),
      faithValue: document.getElementById('faith-value'),
      powerValue: document.getElementById('power-value'),
      faithLabel: document.getElementById('faith-label'),
      powerLabel: document.getElementById('power-label'),
      pauseBtn: document.getElementById('btn-pause'),
      speedBtn: document.getElementById('btn-speed'),
      langBtn: document.getElementById('btn-lang'),
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingText: document.getElementById('loading-text'),
      gameOverModal: document.getElementById('game-over-modal'),
      modalTitle: document.getElementById('modal-title'),
      modalMessage: document.getElementById('modal-message'),
      restartBtn: document.getElementById('modal-restart'),
      oracleTitle: document.getElementById('oracle-title')
    };

    // Initialize Gemini client
    const llmAvailable = GeminiClient.init();
    console.log('LLM available:', llmAvailable);

    // Initialize renderer
    Renderer.init();

    // Initialize systems
    TimeSystem.init({
      onHourChange: (hour, day) => this.onHourChange(hour, day),
      onDayChange: (day) => this.onDayChange(day)
    });

    OracleSystem.init({
      onOracleProcessed: (oracle, reactions, usedLLM) => this.onOracleProcessed(oracle, reactions, usedLLM)
    });

    // Initialize UI components
    NPCPanel.init();
    OraclePanel.init();
    OraclePanel.updateTargetOptions();
    MessageLog.init();

    // Bind control events
    this.bindEvents();

    // Subscribe to state changes
    this.subscribeToStateChanges();

    // Generate initial schedule
    await this.generateDailyScript();

    // Apply initial schedule
    ScheduleSystem.applyScheduleForHour(GameState.get('time.hour'));

    // Update UI
    this.updateUI();

    // Start render loop
    this.startRenderLoop();

    console.log('Game initialized');
  }

  bindEvents() {
    // Pause/Play button
    this.elements.pauseBtn.addEventListener('click', () => {
      const isPaused = TimeSystem.togglePause();
      this.elements.pauseBtn.textContent = isPaused ? '▶' : '⏸';
    });

    // Speed button
    this.elements.speedBtn.addEventListener('click', () => {
      const newSpeed = TimeSystem.cycleSpeed();
      this.elements.speedBtn.textContent = `${newSpeed}x`;
    });

    // Language button
    this.elements.langBtn.addEventListener('click', () => {
      GameState.toggleLanguage();
      this.elements.langBtn.textContent = GameState.get('language') === 'zh' ? 'EN' : '中';
    });

    // Restart button
    this.elements.restartBtn.addEventListener('click', () => {
      this.restart();
    });
  }

  subscribeToStateChanges() {
    GameState.subscribe((path, value, state) => {
      if (path === 'time.hour' || path === 'time.day') {
        this.updateTimeDisplay();
      } else if (path === 'faith' || path.startsWith('faith')) {
        this.updateFaithDisplay();
      } else if (path === 'divinePower' || path.startsWith('divinePower')) {
        this.updatePowerDisplay();
      } else if (path === 'loading') {
        this.updateLoadingOverlay(value.isLoading, value.message);
      } else if (path === 'gameOver') {
        this.showGameOver(value.victory);
      } else if (path === 'language') {
        this.updateLanguage();
      }
    });
  }

  async generateDailyScript() {
    if (!GeminiClient.isAvailable()) {
      // Use skeleton schedule
      const skeleton = ScheduleSystem.generateSkeletonSchedule();
      ScheduleSystem.setDailyScript(skeleton);
      return;
    }

    GameState.setLoading(true, GameState.t('generatingScript'));

    try {
      const gameState = ScheduleSystem.getCurrentStateForLLM();
      const prompt = buildDailyScriptPrompt(gameState);
      const response = await GeminiClient.generateJSON(prompt);
      const script = parseDailyScript(response);
      ScheduleSystem.setDailyScript(script);
    } catch (error) {
      console.error('Failed to generate daily script:', error);
      // Fall back to skeleton
      const skeleton = ScheduleSystem.generateSkeletonSchedule();
      ScheduleSystem.setDailyScript(skeleton);
    }

    GameState.setLoading(false);
  }

  onHourChange(hour, day) {
    ScheduleSystem.applyScheduleForHour(hour);
    this.updateTimeDisplay();
  }

  async onDayChange(day) {
    // Generate new script for the new day
    await this.generateDailyScript();
  }

  onOracleProcessed(oracle, reactions, usedLLM) {
    console.log('Oracle processed:', oracle.type, 'LLM:', usedLLM, reactions);
    // Update LLM status indicator
    MessageLog.setLLMStatus(usedLLM);
    // Display NPC reactions in message log
    MessageLog.addReactions(oracle, reactions);
  }

  updateUI() {
    this.updateTimeDisplay();
    this.updateFaithDisplay();
    this.updatePowerDisplay();
    this.updateLanguage();
  }

  updateTimeDisplay() {
    this.elements.dayDisplay.textContent = TimeSystem.getFormattedDay();
    this.elements.hourDisplay.textContent = TimeSystem.getFormattedTime();
  }

  updateFaithDisplay() {
    const faith = GameState.get('faith');
    const percentage = Math.max(0, Math.min(100, faith.global));
    this.elements.faithBar.style.width = `${percentage}%`;
    this.elements.faithValue.textContent = `${faith.global}/${faith.target}`;
  }

  updatePowerDisplay() {
    const power = GameState.get('divinePower');
    this.elements.powerValue.textContent = `${power.current}/${power.max}`;
  }

  updateLoadingOverlay(isLoading, message) {
    if (isLoading) {
      this.elements.loadingOverlay.classList.remove('hidden');
      this.elements.loadingText.textContent = message || GameState.t('loading');
    } else {
      this.elements.loadingOverlay.classList.add('hidden');
    }
  }

  updateLanguage() {
    // Update static text
    this.elements.title.textContent = GameState.t('title');
    this.elements.faithLabel.textContent = GameState.t('faith');
    this.elements.powerLabel.textContent = GameState.t('power');
    this.elements.oracleTitle.textContent = GameState.t('oracle');

    // Update time display
    this.updateTimeDisplay();

    // Update oracle input placeholder
    const oracleInput = document.getElementById('oracle-input');
    if (oracleInput) {
      oracleInput.placeholder = GameState.t('oraclePlaceholder');
    }

    // Update send button
    const sendBtn = document.getElementById('oracle-send');
    if (sendBtn) {
      sendBtn.textContent = GameState.t('send');
    }

    // Update target select first option
    const targetSelect = document.getElementById('oracle-target');
    if (targetSelect && targetSelect.options[0]) {
      targetSelect.options[0].textContent = GameState.t('broadcast');
    }

    // Update restart button
    this.elements.restartBtn.textContent = GameState.t('restart');

    // Update NPC thoughts header
    const thoughtsHeader = document.querySelector('#npc-thoughts h3');
    if (thoughtsHeader) {
      thoughtsHeader.textContent = GameState.t('thoughts');
    }

    // Update message log title
    MessageLog.updateLanguage();
  }

  showGameOver(victory) {
    this.elements.gameOverModal.classList.remove('hidden');
    this.elements.modalTitle.textContent = victory ? GameState.t('victory') : GameState.t('defeat');
    this.elements.modalMessage.textContent = victory
      ? GameState.t('victoryMessage')
      : GameState.t('defeatMessage');
  }

  restart() {
    // Reset game state
    GameState.reset();

    // Hide modal
    this.elements.gameOverModal.classList.add('hidden');

    // Reset UI
    this.elements.pauseBtn.textContent = '▶';
    this.elements.speedBtn.textContent = '1x';

    // Re-initialize
    this.init();
  }

  startRenderLoop() {
    const loop = () => {
      Renderer.render();
      this.animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init().catch(console.error);
});
