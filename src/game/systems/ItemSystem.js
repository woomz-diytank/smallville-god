import { getItemRegistry } from '../data/ItemRegistry.js';
import behaviorLibrary from '../data/behaviorLibrary.json';

/**
 * Manages runtime item inventories for NPCs and locations,
 * and validates skill execution against item requirements.
 *
 * Storage model:
 *   - Each NPC has a personal inventory (tools, weapons, clothing on their person)
 *   - Each location has shared storage (communal raw materials, food stockpiles)
 *   - `haul` skill moves items between location storages
 */
export class ItemSystem {
  constructor(npcIds, locationIds) {
    this._registry = getItemRegistry();
    this._npcInv = {};
    this._locationInv = {};
    this._skillIndex = null;

    for (const id of npcIds) {
      this._npcInv[id] = {};
    }
    for (const id of locationIds) {
      this._locationInv[id] = {};
    }

    this._buildSkillIndex();
  }

  // ------------------------------------------------------------------
  //  Inventory operations
  // ------------------------------------------------------------------

  add(ownerId, itemId, quantity = 1) {
    const inv = this._resolve(ownerId);
    if (!inv) return false;

    if (this._registry.isDurable(itemId)) {
      if (!inv[itemId]) inv[itemId] = [];
      for (let i = 0; i < quantity; i++) {
        inv[itemId].push({
          durability: this._registry.getMaxDurability(itemId)
        });
      }
    } else {
      inv[itemId] = (inv[itemId] || 0) + quantity;
    }
    return true;
  }

  remove(ownerId, itemId, quantity = 1) {
    const inv = this._resolve(ownerId);
    if (!inv) return false;

    if (this._registry.isDurable(itemId)) {
      if (!inv[itemId] || inv[itemId].length < quantity) return false;
      inv[itemId].splice(0, quantity);
      if (inv[itemId].length === 0) delete inv[itemId];
    } else {
      if ((inv[itemId] || 0) < quantity) return false;
      inv[itemId] -= quantity;
      if (inv[itemId] <= 0) delete inv[itemId];
    }
    return true;
  }

  transfer(fromId, toId, itemId, quantity = 1) {
    if (!this.has(fromId, itemId, quantity)) return false;
    this.remove(fromId, itemId, quantity);
    this.add(toId, itemId, quantity);
    return true;
  }

  has(ownerId, itemId, quantity = 1) {
    const inv = this._resolve(ownerId);
    if (!inv) return false;

    if (this._registry.isDurable(itemId)) {
      return (inv[itemId]?.length || 0) >= quantity;
    }
    return (inv[itemId] || 0) >= quantity;
  }

  getQuantity(ownerId, itemId) {
    const inv = this._resolve(ownerId);
    if (!inv || !inv[itemId]) return 0;

    if (this._registry.isDurable(itemId)) {
      return inv[itemId].length;
    }
    return inv[itemId];
  }

  getInventory(ownerId) {
    return this._resolve(ownerId) || {};
  }

  // ------------------------------------------------------------------
  //  Durability
  // ------------------------------------------------------------------

  decreaseDurability(ownerId, itemId, amount = 1) {
    const inv = this._resolve(ownerId);
    if (!inv || !this._registry.isDurable(itemId)) return null;

    const instances = inv[itemId];
    if (!instances || instances.length === 0) return null;

    const item = instances[0];
    item.durability = Math.max(0, item.durability - amount);

    if (item.durability <= 0) {
      instances.shift();
      if (instances.length === 0) delete inv[itemId];
      return { broken: true, remaining: instances.length };
    }
    return { broken: false, durability: item.durability };
  }

  repairItem(ownerId, itemId) {
    const inv = this._resolve(ownerId);
    if (!inv || !this._registry.isDurable(itemId)) return false;

    const instances = inv[itemId];
    if (!instances || instances.length === 0) return false;

    const worst = instances.reduce((a, b) =>
      a.durability < b.durability ? a : b
    );
    worst.durability = this._registry.getMaxDurability(itemId);
    return true;
  }

  // ------------------------------------------------------------------
  //  Skill-Item validation
  // ------------------------------------------------------------------

  /**
   * Check whether an NPC can execute a skill given available items.
   * Looks at both NPC personal inventory and current location storage.
   *
   * @returns {{ valid: boolean, missing: string[] }}
   */
  canExecuteSkill(npcId, skillId, locationId) {
    const skillDef = this._getSkillDef(skillId);
    if (!skillDef) return { valid: false, missing: ['unknown_skill'] };

    const missing = [];

    for (const reqItem of (skillDef.requires || [])) {
      if (!this.has(npcId, reqItem) && !this.has(locationId, reqItem)) {
        missing.push(reqItem);
      }
    }

    for (const conItem of (skillDef.consumes || [])) {
      const alternatives = ItemSystem._parseConsumeEntry(conItem);
      const anyAvailable = alternatives.some(({ item, qty }) =>
        this.getQuantity(npcId, item) + this.getQuantity(locationId, item) >= qty
      );
      if (!anyAvailable) {
        missing.push(conItem);
      }
    }

    return { valid: missing.length === 0, missing };
  }

  /**
   * Apply the item consequences of executing a skill:
   *   - Decrease durability on required tools
   *   - Consume materials
   *   - Add produced items to location storage
   *
   * Call this AFTER LLM decision has been validated.
   */
  applySkillResult(npcId, skillId, locationId) {
    const skillDef = this._getSkillDef(skillId);
    if (!skillDef) return false;

    for (const reqItem of (skillDef.requires || [])) {
      const owner = this.has(npcId, reqItem) ? npcId : locationId;
      this.decreaseDurability(owner, reqItem);
    }

    for (const conItem of (skillDef.consumes || [])) {
      const alternatives = ItemSystem._parseConsumeEntry(conItem);
      for (const { item, qty } of alternatives) {
        const total = this.getQuantity(npcId, item) + this.getQuantity(locationId, item);
        if (total >= qty) {
          let remaining = qty;
          const npcHas = Math.min(this.getQuantity(npcId, item), remaining);
          if (npcHas > 0) { this.remove(npcId, item, npcHas); remaining -= npcHas; }
          if (remaining > 0) { this.remove(locationId, item, remaining); }
          break;
        }
      }
    }

    for (const prodItem of (skillDef.produces || [])) {
      this.add(locationId, prodItem, 1);
    }

    return true;
  }

  // ------------------------------------------------------------------
  //  Context for LLM prompts
  // ------------------------------------------------------------------

  getPromptContext(npcId, locationId) {
    const npcItems = this._summarize(this._npcInv[npcId]);
    const locItems = this._summarize(this._locationInv[locationId]);

    const lines = [];
    if (npcItems.length > 0) {
      lines.push(`随身物品: ${npcItems.join(', ')}`);
    }
    if (locItems.length > 0) {
      lines.push(`当前地点物资: ${locItems.join(', ')}`);
    }
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  //  Internal helpers
  // ------------------------------------------------------------------

  _resolve(ownerId) {
    return this._npcInv[ownerId] || this._locationInv[ownerId] || null;
  }

  _summarize(inv) {
    if (!inv) return [];
    const parts = [];
    for (const [itemId, val] of Object.entries(inv)) {
      const def = this._registry.get(itemId);
      const name = def?.nameCn || itemId;
      if (Array.isArray(val)) {
        if (val.length > 0) {
          const durStr = val.map(v => v.durability).join('/');
          parts.push(`${name}(耐久${durStr})`);
        }
      } else if (val > 0) {
        parts.push(`${name}x${val}`);
      }
    }
    return parts;
  }

  _buildSkillIndex() {
    this._skillIndex = new Map();
    const physical = behaviorLibrary.skills.PHYSICAL;
    for (const group of [physical.extraction, physical.crafting, physical.utility]) {
      for (const skill of group) {
        this._skillIndex.set(skill.id, skill);
      }
    }
  }

  _getSkillDef(skillId) {
    return this._skillIndex.get(skillId) ?? null;
  }

  static _parseConsumeEntry(entry) {
    return entry.split('|').map(p => {
      const [item, qtyStr] = p.split(':');
      return { item, qty: parseInt(qtyStr) || 1 };
    });
  }
}
