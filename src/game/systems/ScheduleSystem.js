import GameState from '../GameState.js';
import NPC_PROFILES from '../data/npcProfiles.js';

class ScheduleSystemManager {
  constructor() {
    this.dailyScript = null;
  }

  // Generate a rule-based skeleton schedule (fallback when LLM unavailable)
  generateSkeletonSchedule() {
    const schedule = {};

    for (const [npcId, profile] of Object.entries(NPC_PROFILES)) {
      schedule[npcId] = [];

      // Convert daily routine to hourly schedule
      const routine = profile.dailyRoutine;

      for (let hour = 0; hour < 24; hour++) {
        // Get the scheduled activity for this hour
        const activity = routine[hour];

        if (activity) {
          schedule[npcId].push({
            hour,
            location: activity.location,
            action: activity.action,
            thought: this.generateDefaultThought(npcId, activity.action, activity.location, hour)
          });
        } else {
          // Find the most recent scheduled activity
          let lastActivity = null;
          for (let h = hour - 1; h >= 0; h--) {
            if (routine[h]) {
              lastActivity = routine[h];
              break;
            }
          }
          // If no earlier activity, check from end of day
          if (!lastActivity) {
            for (let h = 23; h > hour; h--) {
              if (routine[h]) {
                lastActivity = routine[h];
                break;
              }
            }
          }

          if (lastActivity) {
            schedule[npcId].push({
              hour,
              location: lastActivity.location,
              action: lastActivity.action,
              thought: this.generateDefaultThought(npcId, lastActivity.action, lastActivity.location, hour)
            });
          }
        }
      }
    }

    return schedule;
  }

  generateDefaultThought(npcId, action, location, hour) {
    // Time-based thoughts
    const isNight = hour >= 22 || hour < 6;
    const isMorning = hour >= 6 && hour < 10;
    const isEvening = hour >= 18 && hour < 22;

    const thoughts = {
      elara: {
        // Altar actions
        praying: isMorning ? '新的一天，感谢神明的眷顾...' : '愿神灵保佑这片土地上的所有生灵...',
        meditating: '让心灵归于平静，聆听神的声音...',
        cleaning_altar: '神圣的祭坛必须保持洁净...',
        lighting_candles: '愿这烛光照亮迷途者的道路...',
        reading_scriptures: '经文中蕴含着神的智慧...',
        blessing_visitors: '愿神明保佑你，旅人...',
        arranging_offerings: '信众们的供品承载着他们的祈愿...',
        polishing_statues: '神像必须光亮如新...',
        sweeping_temple: '清扫神殿是我的神圣职责...',
        tending_incense: '袅袅香烟，将祈愿送往天际...',
        sleeping: isNight ? '...' : '小憩片刻，恢复精力...',
        eating: '感谢神明赐予的食物...',
        // Plaza actions
        preaching: '希望能将神的福音传递给更多人...',
        buying_supplies: '需要采购一些祭坛用品...',
        drawing_water: '打些水回去清洗祭坛...',
        feeding_pigeons: '这些小生灵也是神的造物...',
        chatting_merchants: '商贩们今天有什么新消息？',
        // Forest actions
        gathering_herbs: '这些草药可以帮助患病的信众...',
        meditating_nature: '在自然中更能感受神的伟大...',
        bird_watching: '聆听鸟儿歌唱，这是自然的赞美诗...'
      },
      sly: {
        // Tavern actions
        drinking: isEvening ? '今天的收获还行，值得喝一杯...' : '醒酒的最好办法就是再喝一杯...',
        drinking_with_others: '这帮家伙虽然吵闹，但总比一个人强...',
        gambling: '手气不错...或者说技术不错...',
        listening_gossip: '消息就是货币，知道得越多越好...',
        telling_stories: '让我讲讲我年轻时的冒险...',
        arm_wrestling: '没人能在这张桌子上赢我...',
        counting_coins: '今天赚了多少...唉，又要省着花了...',
        sleeping: isNight ? '...' : '先眯一会儿...',
        eating: '填饱肚子是生存的第一要务...',
        mopping_floor: '帮老板干点活换顿饭...',
        // Plaza actions
        people_watching: '看看今天有没有什么可乘之机...',
        haggling: '这价格太离谱了，三成！',
        pickpocketing: '目标太警觉了...下次再说...',
        spreading_rumors: '听说东边的商队出事了...',
        selling_goods: '看看这个，绝对是好东西...',
        // Forest actions
        setting_traps: '希望明天能有收获...',
        hunting: '看到猎物了，别出声...',
        foraging: '这些野果还能吃...',
        hiding: '有人来了，先躲起来...',
        napping_under_tree: '难得的清净，睡一会儿...',
        fishing: '钓鱼最需要耐心...我最缺的就是这个...',
        carving_wood: '雕个小玩意打发时间...',
        exploring_trails: '这条路通向哪里？'
      }
    };

    const npcThoughts = thoughts[npcId];
    if (npcThoughts && npcThoughts[action]) {
      return npcThoughts[action];
    }

    // Default thoughts by action category
    if (action.includes('sleeping')) return '...';
    if (action.includes('drinking')) return '喝点东西放松一下...';
    if (action.includes('pray') || action.includes('meditat')) return '静心...';

    return '...';
  }

  // Apply schedule for current hour
  applyScheduleForHour(hour) {
    const script = this.dailyScript || this.generateSkeletonSchedule();

    for (const npcId of Object.keys(GameState.get('npcs'))) {
      const npcSchedule = script[npcId];
      if (!npcSchedule) continue;

      const hourData = npcSchedule.find(s => s.hour === hour);
      if (!hourData) continue;

      GameState.updateNpc(npcId, {
        location: hourData.location,
        action: hourData.action,
        thought: hourData.thought || null
      });
    }
  }

  // Set LLM-generated daily script
  setDailyScript(script) {
    this.dailyScript = script;
    GameState.set('dailyScript', script);
  }

  // Update remaining schedule after oracle intervention
  updateRemainingSchedule(newScript, fromHour) {
    if (!this.dailyScript) {
      this.dailyScript = this.generateSkeletonSchedule();
    }

    // Merge new script into existing schedule from fromHour onwards
    for (const [npcId, hours] of Object.entries(newScript)) {
      if (!this.dailyScript[npcId]) continue;

      for (const hourData of hours) {
        if (hourData.hour >= fromHour) {
          const idx = this.dailyScript[npcId].findIndex(s => s.hour === hourData.hour);
          if (idx >= 0) {
            this.dailyScript[npcId][idx] = hourData;
          }
        }
      }
    }

    GameState.set('dailyScript', this.dailyScript);
  }

  // Get current state for LLM context
  getCurrentStateForLLM() {
    const time = GameState.get('time');
    const npcs = GameState.getAllNpcs();

    return {
      day: time.day,
      currentHour: time.hour,
      remainingHours: 24 - time.hour,
      npcs: npcs.map(npc => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        currentLocation: npc.location,
        currentAction: npc.action,
        faith: npc.faith,
        recentMemories: npc.memory.slice(-3)
      }))
    };
  }
}

export const ScheduleSystem = new ScheduleSystemManager();
export default ScheduleSystem;
