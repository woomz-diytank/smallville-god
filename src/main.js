import './style.css';
import GameState from './game/GameState.js';
import BehaviorSystem from './game/systems/BehaviorSystem.js';
import SimLogger from './game/systems/SimLogger.js';
import behaviorLibrary from './game/data/behaviorLibrary.json';
import { TIME, UI } from './game/config.js';

class Game {
  constructor() {
    this.tickTimer = null;
  }

  init() {
    BehaviorSystem.init();
    SimLogger.startSession(BehaviorSystem.llmAvailable);
    window.SimLogger = SimLogger;

    this._cacheDOM();
    this._bindEvents();
    GameState.subscribe(() => this.render());
    this.render();
    this._updateTimeline();

    window.addEventListener('beforeunload', () => SimLogger.saveBeforeUnload());

    const llmOn = BehaviorSystem.llmAvailable;
    const badge = document.getElementById('llm-badge');
    badge.textContent = llmOn ? 'LLM' : 'Rules';
    badge.className = llmOn ? 'on' : 'off';
    console.log(`[Game] LLM ${llmOn ? 'ON' : 'OFF (set VITE_GEMINI_API_KEY in .env)'}`);
  }

  _cacheDOM() {
    this.els = {
      day: document.getElementById('day-display'),
      hour: document.getElementById('hour-display'),
      phase: document.getElementById('phase-display'),
      pauseBtn: document.getElementById('btn-pause'),
      speedBtn: document.getElementById('btn-speed'),
      logContent: document.getElementById('log-content'),
      dialogueContent: document.getElementById('dialogue-content'),
      timelineNodes: document.getElementById('timeline-nodes'),
      timelineLabel: document.getElementById('timeline-label'),
      locationCards: {},
    };
    for (const id of Object.keys(behaviorLibrary.locations)) {
      const card = document.querySelector(`.location-card[data-id="${id}"]`);
      this.els.locationCards[id] = {
        npcs: card.querySelector('.loc-npcs'),
        items: card.querySelector('.loc-items'),
      };
    }
  }

  _bindEvents() {
    this.els.pauseBtn.addEventListener('click', () => {
      const paused = GameState.togglePause();
      this.els.pauseBtn.textContent = paused ? '▶' : '⏸';
      if (!paused) {
        GameState.clearViewing();
        this._startTimer();
      } else {
        this._stopTimer();
      }
    });

    this.els.speedBtn.addEventListener('click', () => {
      const speed = GameState.cycleSpeed();
      this.els.speedBtn.textContent = `${speed}x`;
      if (!GameState.get('time.isPaused')) {
        this._stopTimer();
        this._startTimer();
      }
    });

    document.getElementById('btn-download-log').addEventListener('click', () => {
      SimLogger.download();
    });

    const prevBtn = document.getElementById('btn-download-prev');
    if (SimLogger.hasPreviousLog()) {
      prevBtn.style.display = '';
      prevBtn.addEventListener('click', () => SimLogger.downloadPrevious());
    } else {
      prevBtn.style.display = 'none';
    }

    document.getElementById('app').addEventListener('click', (e) => {
      const nameEl = e.target.closest('.npc-name[data-npc-id]');
      if (nameEl) {
        e.stopPropagation();
        this._openNpcPanel(nameEl.dataset.npcId);
      }
    });

    const overlay = document.getElementById('npc-panel-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeNpcPanel();
    });

    this.els.timelineNodes.addEventListener('click', (e) => {
      const node = e.target.closest('.tl-node');
      if (!node || node.classList.contains('never')) return;

      const hour = parseInt(node.dataset.hour, 10);
      const currentHour = GameState.get('time.hour');

      if (hour === currentHour && !GameState.get('time.isPaused')) {
        GameState.clearViewing();
      } else {
        const snap = GameState.getSnapshot(hour);
        if (snap) {
          GameState.setViewingHour(hour);
        }
      }
      this._updateTimelineLabel(hour);
    });
  }

  _startTimer() {
    this._stopTimer();
    const speed = GameState.get('time.speed');
    this.tickTimer = setInterval(() => this._tick(), TIME.MS_PER_HOUR / speed);
  }

  _stopTimer() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  _tick() {
    const { hour, day } = GameState.advanceHour();
    const { results } = BehaviorSystem.tick();

    for (const r of results) {
      if (r.skill === 'sleep' || r.skill === 'rest') continue;
      const npc = GameState.getNpc(r.npc);
      GameState.addLog({
        hour: `${String(hour).padStart(2, '0')}:00`,
        day,
        npcName: npc.nameCn,
        text: r.detail,
      });
    }

    this._updateTimeline();
    this.render();
  }

  _updateTimeline() {
    const currentHour = GameState.get('time.hour');
    const dayStartHour = GameState.getDayStartHour();
    const viewingHour = GameState.state.viewingHour;

    let html = '';
    for (let h = 0; h < 24; h++) {
      let cls = '';
      if (h < dayStartHour) {
        cls = 'never';
      } else if (h > currentHour) {
        cls = 'pending';
      } else {
        const snap = GameState.getSnapshot(h);
        if (snap && snap.dialogues && snap.dialogues.length > 0) {
          cls = 'has-dialogue';
        } else if (snap) {
          cls = 'simulated';
        } else {
          cls = 'simulated';
        }
      }
      if (h === currentHour) cls += ' current';
      if (h === viewingHour) cls += ' viewing';

      html += `<div class="tl-node ${cls}" data-hour="${h}"><div class="tl-dot"></div><span class="tl-hour">${h}</span></div>`;
    }
    this.els.timelineNodes.innerHTML = html;

    this._updateTimelineLabel(viewingHour ?? currentHour);
  }

  _updateTimelineLabel(hour) {
    this.els.timelineLabel.textContent = `${String(hour).padStart(2, '0')}:00`;
    const isViewing = GameState.state.viewingHour !== null;
    this.els.timelineLabel.className = isViewing ? 'viewing' : '';
  }

  _openNpcPanel(npcId) {
    const npc = GameState.getNpc(npcId);
    if (!npc) return;
    const def = behaviorLibrary.npcs[npcId];
    if (!def) return;

    document.getElementById('npc-panel-name').textContent = npc.nameCn;
    document.getElementById('npc-panel-age').textContent = `${def.age}岁`;

    document.getElementById('npc-panel-stats').innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">生存状态</div>
        ${this._panelStatBar('饱食', 'hunger', npc.hunger)}
        ${this._panelStatBar('体力', 'energy', npc.energy)}
      </div>`;

    const shortGoal = npc.shortTermGoal || def.initialGoals?.short || '—';
    const longGoal = npc.longTermGoal || def.initialGoals?.long || '—';
    document.getElementById('npc-panel-goals').innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">目标</div>
        <div class="panel-goal"><span class="panel-goal-label">近期:</span>${shortGoal}</div>
        <div class="panel-goal"><span class="panel-goal-label">远期:</span>${longGoal}</div>
      </div>`;

    const allSkills = [
      ...behaviorLibrary.skills.PHYSICAL.extraction,
      ...behaviorLibrary.skills.PHYSICAL.crafting,
      ...behaviorLibrary.skills.PHYSICAL.utility,
    ];
    const socialSkills = behaviorLibrary.skills.SOCIAL;
    const mentalSkills = behaviorLibrary.skills.MENTAL;

    const groups = [
      { label: '体力', ids: def.skills.PHYSICAL, defs: allSkills },
      { label: '社交', ids: def.skills.SOCIAL, defs: socialSkills },
      { label: '思维', ids: def.skills.MENTAL, defs: mentalSkills },
    ];

    const skillHtml = groups
      .filter(g => g.ids && g.ids.length > 0)
      .map(g => {
        const tags = g.ids.map(id => {
          const s = g.defs.find(d => d.id === id);
          return `<span class="panel-skill-tag">${s?.nameCn || id}</span>`;
        }).join('');
        return `<div class="panel-skill-group"><div class="panel-skill-group-name">${g.label}</div><div class="panel-skill-tags">${tags}</div></div>`;
      }).join('');

    document.getElementById('npc-panel-skills').innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">技能</div>
        ${skillHtml}
      </div>`;

    document.getElementById('npc-panel-bg').innerHTML = `
      <div class="panel-section">
        <div class="panel-section-title">背景</div>
        <div class="panel-bg-text">${def.background}</div>
      </div>`;

    document.getElementById('npc-panel-overlay').classList.remove('hidden');
  }

  _closeNpcPanel() {
    document.getElementById('npc-panel-overlay').classList.add('hidden');
  }

  _panelStatBar(label, type, value) {
    const v = Math.round(value);
    return `<div class="panel-stat-row">
      <span class="panel-stat-label">${label}</span>
      <div class="panel-stat-bar"><div class="panel-stat-fill ${type}" style="width:${v}%"></div></div>
      <span class="panel-stat-value">${v}</span>
    </div>`;
  }

  render() {
    const { time } = GameState.state;
    const phase = GameState.getPhase();
    const viewingHour = GameState.state.viewingHour;
    const isViewing = viewingHour !== null;
    const snapshot = isViewing ? GameState.getSnapshot(viewingHour) : null;

    this.els.day.textContent = `第 ${time.day} 天`;
    this.els.hour.textContent = `${String(time.hour).padStart(2, '0')}:00`;
    this.els.phase.textContent = phase.nameCn;

    for (const locId of Object.keys(this.els.locationCards)) {
      const card = document.querySelector(`.location-card[data-id="${locId}"]`);
      if (!card) continue;
      const nameEl = card.querySelector('.loc-name');
      if (GameState.isProjectBuildable(locId)) {
        nameEl.textContent = GameState.getProjectDisplayName(locId);
        card.classList.toggle('unbuilt', !GameState.isProjectComplete(locId));
      } else {
        card.classList.remove('unbuilt');
      }
    }

    const items = BehaviorSystem.getItemSystem();
    const npcSource = snapshot ? snapshot.npcs : GameState.state.npcs;

    for (const [locId, els] of Object.entries(this.els.locationCards)) {
      const npcsHere = Object.values(npcSource).filter(n => n.location === locId);

      if (npcsHere.length === 0) {
        els.npcs.innerHTML = '<span class="npc-skill" style="opacity:0.3">— 无人 —</span>';
      } else {
        els.npcs.innerHTML = npcsHere.map(npc => `
          <div class="npc-row">
            <span class="npc-name" data-npc-id="${npc.id}">${npc.nameCn}</span>
            <span class="npc-skill">${npc.thought || npc.currentSkill || '待命'}</span>
            <div class="npc-bars">
              <div class="bar bar-hunger" title="饱食 ${Math.round(npc.hunger)}">
                <div class="bar-fill" style="width:${npc.hunger}%"></div>
              </div>
              <div class="bar bar-energy" title="体力 ${Math.round(npc.energy)}">
                <div class="bar-fill" style="width:${npc.energy}%"></div>
              </div>
            </div>
          </div>
        `).join('');
      }

      if (!isViewing) {
        const inv = items.getInventory(locId);
        const itemTexts = [];
        for (const [itemId, val] of Object.entries(inv)) {
          const def = items._registry.get(itemId);
          const name = def?.nameCn || itemId;
          if (Array.isArray(val)) {
            if (val.length > 0) itemTexts.push(`${name}×${val.length}`);
          } else if (val > 0) {
            itemTexts.push(`${name}×${val}`);
          }
        }
        els.items.textContent = itemTexts.length > 0 ? itemTexts.join('  ') : '— 无物资 —';
      }
    }

    this._renderDialogues(snapshot);
    this._renderLog(snapshot);
  }

  _renderDialogues(snapshot) {
    let source;
    if (snapshot) {
      source = snapshot.dialogues || [];
    } else {
      source = GameState.state.latestDialogues || [];
    }

    if (source.length === 0) {
      this.els.dialogueContent.innerHTML = '';
      return;
    }

    let html = '';
    for (const group of source) {
      html += `<div class="dialogue-group">`;
      html += `<span class="dialogue-loc-tag">${group.locName}</span>`;
      for (const line of group.lines) {
        html += `<div class="dialogue-line"><span class="dlg-speaker">${line.speaker}:</span><span class="dlg-text">${line.text}</span></div>`;
      }
      html += `</div>`;
    }
    this.els.dialogueContent.innerHTML = html;
  }

  _renderLog(snapshot) {
    if (snapshot) {
      const events = snapshot.events || [];
      const logHtml = events.map(e =>
        `<div class="log-entry"><span class="log-npc">${e.npcName}</span> ${e.text}</div>`
      ).join('');
      this.els.logContent.innerHTML = logHtml || '<div class="log-entry" style="opacity:0.3">该时段无特别事件</div>';
    } else {
      const logHtml = GameState.state.log.slice(0, UI.DISPLAY_LOG_LINES).map(e =>
        `<div class="log-entry"><span class="log-time">[${e.hour}]</span><span class="log-npc">${e.npcName}</span> ${e.text}</div>`
      ).join('');
      this.els.logContent.innerHTML = logHtml;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
