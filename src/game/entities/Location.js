import GameState from '../GameState.js';

export class Location {
  constructor(data) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.color = data.color;
  }

  getNpcsHere() {
    return GameState.getAllNpcs().filter(npc => npc.location === this.id);
  }

  getName() {
    return GameState.t(`locations.${this.id}`);
  }

  containsPoint(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }
}

export default Location;
