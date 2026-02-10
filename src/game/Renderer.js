import { GAME_CONFIG, COLORS } from './constants.js';
import GameState from './GameState.js';

class RendererManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.dpr = window.devicePixelRatio || 1;
  }

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Set up click handler
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  resize() {
    const container = this.canvas.parentElement;
    const width = Math.min(GAME_CONFIG.CANVAS_WIDTH, container.clientWidth - 40);
    const height = (width / GAME_CONFIG.CANVAS_WIDTH) * GAME_CONFIG.CANVAS_HEIGHT;

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);

    this.scale = width / GAME_CONFIG.CANVAS_WIDTH;
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;

    // Check if clicked on an NPC
    const npcs = GameState.getAllNpcs();
    for (const npc of npcs) {
      const pos = this.getNpcPosition(npc);
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);

      if (distance <= 25) {
        GameState.set('selectedNpc', npc.id);
        return;
      }
    }

    // Clicked elsewhere, deselect
    GameState.set('selectedNpc', null);
  }

  getNpcPosition(npc) {
    const location = GameState.getLocation(npc.location);
    const npcsInLocation = GameState.getAllNpcs().filter(n => n.location === npc.location);
    const index = npcsInLocation.findIndex(n => n.id === npc.id);

    // Position NPCs within location
    const offsetX = (index % 2) * 60 + 50;
    const offsetY = Math.floor(index / 2) * 50 + 60;

    return {
      x: location.x + offsetX,
      y: location.y + offsetY
    };
  }

  render() {
    this.clear();
    this.drawLocations();
    this.drawNpcs();
  }

  clear() {
    this.ctx.fillStyle = '#0d1117';
    this.ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  }

  drawLocations() {
    const locations = GameState.get('locations');

    for (const loc of Object.values(locations)) {
      // Draw location background
      this.ctx.fillStyle = loc.color;
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.lineWidth = 2;

      this.roundRect(loc.x, loc.y, loc.width, loc.height, 12);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw location name
      const name = GameState.t(`locations.${loc.id}`);
      this.ctx.fillStyle = COLORS.TEXT;
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(name, loc.x + loc.width / 2, loc.y + 25);
    }
  }

  drawNpcs() {
    const npcs = GameState.getAllNpcs();
    const selectedId = GameState.get('selectedNpc');

    for (const npc of npcs) {
      const pos = this.getNpcPosition(npc);
      const isSelected = npc.id === selectedId;

      // Draw selection ring
      if (isSelected) {
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        this.ctx.strokeStyle = COLORS.GOLD;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }

      // Draw NPC circle
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
      this.ctx.fillStyle = npc.color;
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw NPC initial
      this.ctx.fillStyle = '#333';
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(npc.name[0], pos.x, pos.y);

      // Draw NPC name below
      this.ctx.fillStyle = COLORS.TEXT;
      this.ctx.font = '12px sans-serif';
      this.ctx.fillText(npc.name, pos.x, pos.y + 38);

      // Draw action label
      let actionText = GameState.t(`actions.${npc.action}`);
      // If translation not found (returns the key), format it nicely
      if (actionText === `actions.${npc.action}` || actionText.startsWith('actions.')) {
        actionText = npc.action.replace(/_/g, ' ');
      }
      this.ctx.fillStyle = COLORS.TEXT_MUTED;
      this.ctx.font = '10px sans-serif';
      this.ctx.fillText(actionText, pos.x, pos.y + 52);

      // Draw faith indicator
      this.drawFaithIndicator(pos.x + 28, pos.y - 15, npc.faith);
    }
  }

  drawFaithIndicator(x, y, faith) {
    const maxWidth = 30;
    const height = 4;
    const percentage = Math.max(0, Math.min(100, faith)) / 100;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(x - maxWidth / 2, y, maxWidth, height);

    // Faith bar
    const color = faith > 60 ? '#4caf50' : faith > 30 ? '#ff9800' : '#f44336';
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - maxWidth / 2, y, maxWidth * percentage, height);
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  // Draw holy light effect
  drawHolyLightEffect() {
    return new Promise(resolve => {
      let opacity = 0;
      const animate = () => {
        opacity += 0.05;

        this.render();

        // Overlay
        this.ctx.fillStyle = `rgba(255, 215, 0, ${Math.sin(opacity * Math.PI) * 0.3})`;
        this.ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

        if (opacity < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }
}

export const Renderer = new RendererManager();
export default Renderer;
