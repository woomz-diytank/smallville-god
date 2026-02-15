import GameState from '../GameState.js';

class MessageLogManager {
  constructor() {
    this.elements = {};
    this.maxMessages = 20;
  }

  init() {
    this.elements = {
      container: document.getElementById('message-log-content'),
      title: document.getElementById('message-log-title'),
      status: document.getElementById('llm-status')
    };
  }

  setLLMStatus(success) {
    console.log('[MessageLog] setLLMStatus called with:', success);
    if (success) {
      this.elements.status.textContent = 'LLM';
      this.elements.status.className = 'status-indicator llm-success';
    } else {
      this.elements.status.textContent = 'Fallback';
      this.elements.status.className = 'status-indicator llm-fallback';
    }
  }

  addReactions(oracle, reactions) {
    const npcs = GameState.getAllNpcs();

    for (const [npcId, reaction] of Object.entries(reactions)) {
      const npc = npcs.find(n => n.id === npcId);
      if (!npc) continue;

      this.addMessage({
        npcName: npc.name,
        npcColor: npc.color,
        interpretation: reaction.interpretation,
        innerConflict: reaction.innerConflict,
        thought: reaction.newThought,
        faithChange: reaction.faithChange,
        oracleType: oracle.type,
        oracleMessage: oracle.message
      });
    }
  }

  addMessage(data) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    messageEl.style.borderLeftColor = data.npcColor || '#ffd700';

    // NPC name
    const nameEl = document.createElement('div');
    nameEl.className = 'npc-name';
    nameEl.style.color = data.npcColor || '#ffd700';
    nameEl.textContent = data.npcName;
    messageEl.appendChild(nameEl);

    // Interpretation
    if (data.interpretation) {
      const interpEl = document.createElement('div');
      interpEl.className = 'npc-interpretation';
      interpEl.textContent = `"${data.interpretation}"`;
      messageEl.appendChild(interpEl);
    }

    // Inner Conflict
    if (data.innerConflict) {
      const conflictEl = document.createElement('div');
      conflictEl.className = 'npc-conflict';
      conflictEl.textContent = data.innerConflict;
      messageEl.appendChild(conflictEl);
    }

    // Thought
    if (data.thought) {
      const thoughtEl = document.createElement('div');
      thoughtEl.className = 'npc-thought';
      thoughtEl.textContent = `💭 ${data.thought}`;
      messageEl.appendChild(thoughtEl);
    }

    // Faith change
    if (data.faithChange !== undefined && data.faithChange !== 0) {
      const faithEl = document.createElement('div');
      faithEl.className = 'faith-change';

      if (data.faithChange > 0) {
        faithEl.classList.add('positive');
        faithEl.textContent = `${GameState.t('faith')} +${data.faithChange}`;
      } else {
        faithEl.classList.add('negative');
        faithEl.textContent = `${GameState.t('faith')} ${data.faithChange}`;
      }

      messageEl.appendChild(faithEl);
    } else if (data.faithChange === 0) {
      const faithEl = document.createElement('div');
      faithEl.className = 'faith-change neutral';
      faithEl.textContent = `${GameState.t('faith')} +0`;
      messageEl.appendChild(faithEl);
    }

    // Add to container (newest at top)
    this.elements.container.insertBefore(messageEl, this.elements.container.firstChild);

    // Limit messages
    while (this.elements.container.children.length > this.maxMessages) {
      this.elements.container.removeChild(this.elements.container.lastChild);
    }
  }

  clear() {
    this.elements.container.innerHTML = '';
  }

  updateLanguage() {
    this.elements.title.textContent = GameState.t('npcThoughts') || 'NPC 心理活动';
  }
}

export const MessageLog = new MessageLogManager();
export default MessageLog;
