import GameState from '../GameState.js';

export class NPC {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.role = data.role;
    this.color = data.color;
    this.personality = data.personality;
    this.location = data.location;
    this.action = data.action;
    this.faith = data.faith;
    this.memory = data.memory || [];
    this.thought = data.thought || null;
    this.interpretation = data.interpretation || null;
  }

  moveTo(locationId) {
    this.location = locationId;
    GameState.updateNpc(this.id, { location: locationId });
  }

  setAction(action) {
    this.action = action;
    GameState.updateNpc(this.id, { action });
  }

  setThought(thought) {
    this.thought = thought;
    GameState.updateNpc(this.id, { thought });
  }

  setInterpretation(interpretation) {
    this.interpretation = interpretation;
    GameState.updateNpc(this.id, { interpretation });
  }

  addMemory(event) {
    this.memory.push({
      ...event,
      timestamp: {
        day: GameState.get('time.day'),
        hour: GameState.get('time.hour')
      }
    });

    // Keep only recent memories (simplified for MVP)
    if (this.memory.length > 10) {
      this.memory = this.memory.slice(-10);
    }

    GameState.updateNpc(this.id, { memory: this.memory });
  }

  adjustFaith(change) {
    const newFaith = Math.max(0, Math.min(100, this.faith + change));
    this.faith = newFaith;
    GameState.updateNpc(this.id, { faith: newFaith });
    GameState.updateGlobalFaith();
  }

  getProfile() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      personality: this.personality,
      currentLocation: this.location,
      currentAction: this.action,
      faithLevel: this.faith,
      recentMemories: this.memory.slice(-5)
    };
  }
}

export default NPC;
