import { describe, it, expect } from 'vitest';
import { ItemRegistry } from '../src/game/data/ItemRegistry.js';

describe('ItemRegistry', () => {
  const registry = new ItemRegistry();

  describe('get()', () => {
    it('returns consumable item definition', () => {
      const timber = registry.get('timber');
      expect(timber).not.toBeNull();
      expect(timber.nameCn).toBe('木材');
      expect(timber.type).toBe('consumable');
      expect(timber.category).toBe('material');
    });

    it('returns durable item definition', () => {
      const axe = registry.get('axe');
      expect(axe).not.toBeNull();
      expect(axe.nameCn).toBe('斧头');
      expect(axe.type).toBe('durable');
      expect(axe.category).toBe('tool');
      expect(axe.properties.maxDurability).toBe(10);
    });

    it('returns null for non-existent item', () => {
      expect(registry.get('magic_sword')).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('returns all 19 items', () => {
      expect(registry.getAll()).toHaveLength(19);
    });
  });

  describe('getByCategory()', () => {
    it('returns all food items', () => {
      const food = registry.getByCategory('food');
      const ids = food.map(f => f.id);
      expect(ids).toContain('berries');
      expect(ids).toContain('raw_meat');
      expect(ids).toContain('cooked_meat');
    });

    it('returns all tools', () => {
      const tools = registry.getByCategory('tool');
      expect(tools.length).toBe(6);
    });

    it('returns empty for unknown category', () => {
      expect(registry.getByCategory('magic')).toEqual([]);
    });
  });

  describe('type checks', () => {
    it('isConsumable', () => {
      expect(registry.isConsumable('berries')).toBe(true);
      expect(registry.isConsumable('timber')).toBe(true);
      expect(registry.isConsumable('axe')).toBe(false);
    });

    it('isDurable', () => {
      expect(registry.isDurable('bow')).toBe(true);
      expect(registry.isDurable('fur_coat')).toBe(true);
      expect(registry.isDurable('raw_meat')).toBe(false);
    });
  });

  describe('getMaxDurability()', () => {
    it('returns durability for durable items', () => {
      expect(registry.getMaxDurability('axe')).toBe(10);
      expect(registry.getMaxDurability('snare')).toBe(3);
    });

    it('returns null for consumable items', () => {
      expect(registry.getMaxDurability('timber')).toBeNull();
    });
  });

  describe('exists()', () => {
    it('returns true for known items', () => {
      expect(registry.exists('hide')).toBe(true);
    });

    it('returns false for unknown items', () => {
      expect(registry.exists('dragon_scale')).toBe(false);
    });
  });

  describe('item source traceability', () => {
    it('every item has at least one source behavior', () => {
      for (const item of registry.getAll()) {
        expect(item.source.length).toBeGreaterThan(0);
      }
    });
  });
});
