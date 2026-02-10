import GameState from '../GameState.js';

class NPCPanelManager {
  constructor() {
    this.elements = {};
  }

  init() {
    this.elements = {
      panel: document.getElementById('npc-panel'),
      closeBtn: document.getElementById('panel-close'),
      avatar: document.getElementById('npc-avatar'),
      name: document.getElementById('npc-name'),
      role: document.getElementById('npc-role'),
      location: document.getElementById('npc-location'),
      action: document.getElementById('npc-action'),
      faith: document.getElementById('npc-faith'),
      thoughtText: document.getElementById('npc-thought-text')
    };

    this.bindEvents();

    // Subscribe to state changes
    GameState.subscribe((path, value) => {
      if (path === 'selectedNpc') {
        this.updatePanel(value);
      } else if (path.startsWith('npcs.')) {
        // Update panel if the changed NPC is selected
        const selectedId = GameState.get('selectedNpc');
        if (selectedId && path.startsWith(`npcs.${selectedId}`)) {
          this.updatePanel(selectedId);
        }
      } else if (path === 'language') {
        const selectedId = GameState.get('selectedNpc');
        if (selectedId) {
          this.updatePanel(selectedId);
        }
      }
    });
  }

  bindEvents() {
    this.elements.closeBtn.addEventListener('click', () => {
      GameState.set('selectedNpc', null);
    });
  }

  updatePanel(npcId) {
    if (!npcId) {
      this.elements.panel.classList.add('hidden');
      return;
    }

    const npc = GameState.getNpc(npcId);
    if (!npc) {
      this.elements.panel.classList.add('hidden');
      return;
    }

    this.elements.panel.classList.remove('hidden');

    // Update avatar
    this.elements.avatar.style.backgroundColor = npc.color;

    // Update name and role
    const localizedName = GameState.t(`npcs.${npcId}.name`) || npc.name;
    const localizedRole = GameState.t(`npcs.${npcId}.role`) || npc.role;

    this.elements.name.textContent = localizedName;
    this.elements.role.textContent = localizedRole;

    // Update stats
    const locationName = GameState.t(`locations.${npc.location}`);
    let actionName = GameState.t(`actions.${npc.action}`);
    // If translation not found, format the key nicely
    if (actionName === `actions.${npc.action}` || actionName.startsWith('actions.')) {
      actionName = npc.action.replace(/_/g, ' ');
    }

    this.elements.location.textContent = `${locationName}`;
    this.elements.action.textContent = `${actionName}`;
    this.elements.faith.textContent = `${GameState.t('faithLevel')}: ${npc.faith}`;

    // Update thought
    let thought = npc.thought || npc.interpretation || GameState.t(`npcs.${npcId}.defaultThought`);
    this.elements.thoughtText.textContent = thought;
  }

  show(npcId) {
    GameState.set('selectedNpc', npcId);
  }

  hide() {
    GameState.set('selectedNpc', null);
  }
}

export const NPCPanel = new NPCPanelManager();
export default NPCPanel;
