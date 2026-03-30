import behaviorLibrary from './behaviorLibrary.json';

export class ItemRegistry {
  constructor() {
    this._items = new Map();
    this._byCategory = new Map();
    this._load(behaviorLibrary.items);
  }

  _load(itemsDef) {
    for (const type of ['consumable', 'durable']) {
      for (const item of itemsDef[type]) {
        const entry = { ...item, type };
        this._items.set(item.id, entry);

        if (!this._byCategory.has(item.category)) {
          this._byCategory.set(item.category, []);
        }
        this._byCategory.get(item.category).push(entry);
      }
    }
  }

  get(itemId) {
    return this._items.get(itemId) ?? null;
  }

  getAll() {
    return [...this._items.values()];
  }

  getByCategory(category) {
    return this._byCategory.get(category) ?? [];
  }

  isConsumable(itemId) {
    return this._items.get(itemId)?.type === 'consumable';
  }

  isDurable(itemId) {
    return this._items.get(itemId)?.type === 'durable';
  }

  getMaxDurability(itemId) {
    return this._items.get(itemId)?.properties?.maxDurability ?? null;
  }

  exists(itemId) {
    return this._items.has(itemId);
  }
}

let _instance = null;

export function getItemRegistry() {
  if (!_instance) {
    _instance = new ItemRegistry();
  }
  return _instance;
}
