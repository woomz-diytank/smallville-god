import { describe, it, expect, beforeEach } from 'vitest';
import { ItemSystem } from '../src/game/systems/ItemSystem.js';

const NPCS = ['aldric', 'margit', 'roderic', 'agnes', 'clement', 'erik', 'ingrid', 'oskar'];
const LOCATIONS = ['square', 'chapel', 'forge', 'ruins', 'forest', 'storehouse'];

describe('ItemSystem', () => {
  let items;

  beforeEach(() => {
    items = new ItemSystem(NPCS, LOCATIONS);
  });

  // ----------------------------------------------------------------
  //  Basic inventory operations
  // ----------------------------------------------------------------
  describe('consumable inventory', () => {
    it('add and query', () => {
      items.add('forest', 'timber', 5);
      expect(items.getQuantity('forest', 'timber')).toBe(5);
      expect(items.has('forest', 'timber', 5)).toBe(true);
      expect(items.has('forest', 'timber', 6)).toBe(false);
    });

    it('remove decreases quantity', () => {
      items.add('storehouse', 'berries', 10);
      items.remove('storehouse', 'berries', 3);
      expect(items.getQuantity('storehouse', 'berries')).toBe(7);
    });

    it('remove fails if insufficient', () => {
      items.add('storehouse', 'raw_meat', 2);
      expect(items.remove('storehouse', 'raw_meat', 5)).toBe(false);
      expect(items.getQuantity('storehouse', 'raw_meat')).toBe(2);
    });

    it('remove cleans up zero entries', () => {
      items.add('forge', 'scrap_metal', 3);
      items.remove('forge', 'scrap_metal', 3);
      const inv = items.getInventory('forge');
      expect(inv['scrap_metal']).toBeUndefined();
    });
  });

  describe('durable inventory', () => {
    it('add creates instances with full durability', () => {
      items.add('aldric', 'hammer');
      expect(items.has('aldric', 'hammer')).toBe(true);
      expect(items.getQuantity('aldric', 'hammer')).toBe(1);
    });

    it('add multiple creates separate instances', () => {
      items.add('forge', 'axe', 2);
      expect(items.getQuantity('forge', 'axe')).toBe(2);
    });

    it('remove reduces instances', () => {
      items.add('roderic', 'bow', 2);
      items.remove('roderic', 'bow', 1);
      expect(items.getQuantity('roderic', 'bow')).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  //  Transfer
  // ----------------------------------------------------------------
  describe('transfer()', () => {
    it('moves consumables between locations', () => {
      items.add('forest', 'timber', 8);
      items.transfer('forest', 'ruins', 'timber', 3);
      expect(items.getQuantity('forest', 'timber')).toBe(5);
      expect(items.getQuantity('ruins', 'timber')).toBe(3);
    });

    it('moves durables from NPC to location', () => {
      items.add('erik', 'axe');
      items.transfer('erik', 'forge', 'axe');
      expect(items.has('erik', 'axe')).toBe(false);
      expect(items.has('forge', 'axe')).toBe(true);
    });

    it('fails if source lacks items', () => {
      expect(items.transfer('aldric', 'forge', 'hammer')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  //  Durability
  // ----------------------------------------------------------------
  describe('durability', () => {
    it('decreaseDurability reduces value', () => {
      items.add('roderic', 'bow');
      const result = items.decreaseDurability('roderic', 'bow');
      expect(result.broken).toBe(false);
      expect(result.durability).toBe(7); // maxDurability(bow) = 8, 8-1 = 7
    });

    it('item breaks when durability hits 0', () => {
      items.add('roderic', 'snare'); // maxDurability = 3
      items.decreaseDurability('roderic', 'snare'); // 2
      items.decreaseDurability('roderic', 'snare'); // 1
      const result = items.decreaseDurability('roderic', 'snare'); // 0 → broken
      expect(result.broken).toBe(true);
      expect(items.has('roderic', 'snare')).toBe(false);
    });

    it('repairItem restores to max', () => {
      items.add('aldric', 'axe');
      items.decreaseDurability('aldric', 'axe', 5); // 10 → 5
      items.repairItem('aldric', 'axe');
      const inv = items.getInventory('aldric');
      expect(inv['axe'][0].durability).toBe(10);
    });
  });

  // ----------------------------------------------------------------
  //  Skill validation
  // ----------------------------------------------------------------
  describe('canExecuteSkill()', () => {
    it('hunt requires bow - valid when NPC has bow', () => {
      items.add('roderic', 'bow');
      const result = items.canExecuteSkill('roderic', 'hunt', 'forest');
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('hunt requires bow - invalid without bow', () => {
      const result = items.canExecuteSkill('roderic', 'hunt', 'forest');
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('bow');
    });

    it('cook requires cooking_pot + consumes raw_meat and timber', () => {
      items.add('agnes', 'cooking_pot');
      items.add('chapel', 'raw_meat', 2);
      items.add('chapel', 'timber', 3);
      const result = items.canExecuteSkill('agnes', 'cook', 'chapel');
      expect(result.valid).toBe(true);
    });

    it('cook invalid without materials', () => {
      items.add('agnes', 'cooking_pot');
      const result = items.canExecuteSkill('agnes', 'cook', 'chapel');
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('raw_meat');
      expect(result.missing).toContain('timber');
    });

    it('build requires hammer + saw + consumes timber, stone, thatch', () => {
      items.add('oskar', 'hammer');
      items.add('oskar', 'saw');
      items.add('ruins', 'timber', 5);
      items.add('ruins', 'stone', 5);
      items.add('ruins', 'thatch', 5);
      const result = items.canExecuteSkill('oskar', 'build', 'ruins');
      expect(result.valid).toBe(true);
    });

    it('forage requires nothing', () => {
      const result = items.canExecuteSkill('erik', 'forage', 'forest');
      expect(result.valid).toBe(true);
    });

    it('smith requires hammer + consumes scrap_metal and timber', () => {
      items.add('aldric', 'hammer');
      items.add('forge', 'scrap_metal', 2);
      items.add('forge', 'timber', 3);
      const result = items.canExecuteSkill('aldric', 'smith', 'forge');
      expect(result.valid).toBe(true);
    });

    it('tool can be at location instead of on NPC', () => {
      items.add('forge', 'hammer');
      items.add('forge', 'scrap_metal', 1);
      items.add('forge', 'timber', 1);
      const result = items.canExecuteSkill('aldric', 'smith', 'forge');
      expect(result.valid).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  //  Skill execution
  // ----------------------------------------------------------------
  describe('applySkillResult()', () => {
    it('hunt produces raw_meat and hide at location', () => {
      items.add('roderic', 'bow');
      items.applySkillResult('roderic', 'hunt', 'forest');
      expect(items.getQuantity('forest', 'raw_meat')).toBe(1);
      expect(items.getQuantity('forest', 'hide')).toBe(1);
    });

    it('hunt decreases bow durability', () => {
      items.add('roderic', 'bow');
      const before = items.getInventory('roderic')['bow'][0].durability;
      items.applySkillResult('roderic', 'hunt', 'forest');
      const after = items.getInventory('roderic')['bow'][0].durability;
      expect(after).toBe(before - 1);
    });

    it('cook consumes raw_meat + timber, produces cooked_meat', () => {
      items.add('agnes', 'cooking_pot');
      items.add('chapel', 'raw_meat', 3);
      items.add('chapel', 'timber', 5);

      items.applySkillResult('agnes', 'cook', 'chapel');

      expect(items.getQuantity('chapel', 'raw_meat')).toBe(2);
      expect(items.getQuantity('chapel', 'timber')).toBe(4);
      expect(items.getQuantity('chapel', 'cooked_meat')).toBe(1);
    });

    it('forage produces berries and thatch (no consumption)', () => {
      items.applySkillResult('margit', 'forage', 'forest');
      expect(items.getQuantity('forest', 'berries')).toBe(1);
      expect(items.getQuantity('forest', 'thatch')).toBe(1);
    });

    it('chop_wood requires axe, produces timber', () => {
      items.add('erik', 'axe');
      items.applySkillResult('erik', 'chop_wood', 'forest');
      expect(items.getQuantity('forest', 'timber')).toBe(1);
    });

    it('craft_clothing consumes hide, produces fur_coat and leather_boots', () => {
      items.add('ingrid', 'needle_thread');
      items.add('chapel', 'hide', 2);
      items.applySkillResult('ingrid', 'craft_clothing', 'chapel');
      expect(items.getQuantity('chapel', 'hide')).toBe(1);
      expect(items.getQuantity('chapel', 'fur_coat')).toBe(1);
      expect(items.getQuantity('chapel', 'leather_boots')).toBe(1);
    });

    it('build consumes timber, stone, thatch', () => {
      items.add('oskar', 'hammer');
      items.add('oskar', 'saw');
      items.add('ruins', 'timber', 10);
      items.add('ruins', 'stone', 10);
      items.add('ruins', 'thatch', 10);

      items.applySkillResult('oskar', 'build', 'ruins');

      expect(items.getQuantity('ruins', 'timber')).toBe(9);
      expect(items.getQuantity('ruins', 'stone')).toBe(9);
      expect(items.getQuantity('ruins', 'thatch')).toBe(9);
    });

    it('tend_fire consumes timber', () => {
      items.add('chapel', 'timber', 5);
      items.applySkillResult('clement', 'tend_fire', 'chapel');
      expect(items.getQuantity('chapel', 'timber')).toBe(4);
    });
  });

  // ----------------------------------------------------------------
  //  LLM prompt context
  // ----------------------------------------------------------------
  describe('getPromptContext()', () => {
    it('shows NPC items and location items', () => {
      items.add('roderic', 'bow');
      items.add('forest', 'raw_meat', 3);
      items.add('forest', 'hide', 2);

      const ctx = items.getPromptContext('roderic', 'forest');
      expect(ctx).toContain('弓');
      expect(ctx).toContain('生肉x3');
      expect(ctx).toContain('兽皮x2');
    });

    it('returns empty string when nothing available', () => {
      const ctx = items.getPromptContext('clement', 'chapel');
      expect(ctx).toBe('');
    });
  });
});
