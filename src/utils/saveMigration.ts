import type { SaveData, GameTime, EventSystem } from '@/types/game';
import type { SaveDataV3 } from '@/types/saveSchemaV3';
import { normalizeBackpackCurrencies } from '@/utils/currencySystem';

export type SaveMigrationIssue =
  | 'legacy-root-keys'
  | 'missing-required-keys'
  | 'invalid-structure';

export interface SaveMigrationDetection {
  needsMigration: boolean;
  issues: SaveMigrationIssue[];
  legacyKeysFound: string[];
}

export interface SaveMigrationReport {
  legacyKeysFound: string[];
  removedLegacyKeys: string[];
  warnings: string[];
}

/**
 * 从存档数据中提取显示信息（兼容V3和旧格式）
 * 用于存档列表显示，无需完整迁移
 */
export interface SaveDisplayInfo {
  角色名字: string;
  境界: string;
  位置: string;
  游戏时间: GameTime | null;
}

/**
 * 从任意格式的存档数据中提取显示信息
 * 兼容 V3 格式和所有旧格式
 */
export function extractSaveDisplayInfo(saveData: SaveData | null | undefined): SaveDisplayInfo {
  const defaultInfo: SaveDisplayInfo = {
    角色名字: '未知',
    境界: '凡人',
    位置: '未知',
    游戏时间: null,
  };

  if (!saveData || typeof saveData !== 'object') {
    return defaultInfo;
  }

  const anySave = saveData as any;

  // 提取角色名字
  let 角色名字 = defaultInfo.角色名字;
  if (anySave.角色?.身份?.名字) {
    // V3 格式
    角色名字 = anySave.角色.身份.名字;
  } else if (anySave.角色基础信息?.名字) {
    角色名字 = anySave.角色基础信息.名字;
  } else if (anySave.玩家角色基础信息?.名字) {
    角色名字 = anySave.玩家角色基础信息.名字;
  } else if (anySave.玩家角色信息?.名字) {
    角色名字 = anySave.玩家角色信息.名字;
  } else if (anySave.玩家角色状态信息?.角色?.名字) {
    角色名字 = anySave.玩家角色状态信息.角色.名字;
  }

  // 提取境界
  let 境界 = defaultInfo.境界;
  if (anySave.角色?.属性?.境界) {
    // V3 格式
    const realmData = anySave.角色.属性.境界;
    境界 = typeof realmData === 'string' ? realmData : (realmData?.名称 || realmData?.name || '凡人');
  } else if (anySave.属性?.境界) {
    const realmData = anySave.属性.境界;
    境界 = typeof realmData === 'string' ? realmData : (realmData?.名称 || realmData?.name || '凡人');
  } else if (anySave.状态?.境界) {
    const realmData = anySave.状态.境界;
    境界 = typeof realmData === 'string' ? realmData : (realmData?.名称 || realmData?.name || '凡人');
  } else if (anySave.玩家角色状态?.境界) {
    const realmData = anySave.玩家角色状态.境界;
    境界 = typeof realmData === 'string' ? realmData : (realmData?.名称 || realmData?.name || '凡人');
  } else if (anySave.玩家角色状态信息?.境界) {
    const realmData = anySave.玩家角色状态信息.境界;
    境界 = typeof realmData === 'string' ? realmData : (realmData?.名称 || realmData?.name || '凡人');
  }

  // 提取位置
  let 位置 = defaultInfo.位置;
  if (anySave.角色?.位置?.描述) {
    // V3 格式
    位置 = anySave.角色.位置.描述;
  } else if (anySave.角色?.位置?.地点) {
    位置 = anySave.角色.位置.地点;
  } else if (anySave.位置?.描述) {
    位置 = anySave.位置.描述;
  } else if (anySave.位置?.地点) {
    位置 = anySave.位置.地点;
  } else if (typeof anySave.位置 === 'string') {
    位置 = anySave.位置;
  } else if (anySave.状态?.位置) {
    const locData = anySave.状态.位置;
    位置 = typeof locData === 'string' ? locData : (locData?.描述 || locData?.地点 || '未知');
  } else if (anySave.玩家角色状态?.位置) {
    const locData = anySave.玩家角色状态.位置;
    位置 = typeof locData === 'string' ? locData : (locData?.描述 || locData?.地点 || '未知');
  } else if (anySave.玩家角色状态信息?.位置) {
    const locData = anySave.玩家角色状态信息.位置;
    位置 = typeof locData === 'string' ? locData : (locData?.描述 || locData?.地点 || '未知');
  }

  // 提取游戏时间
  let 游戏时间: GameTime | null = null;
  if (anySave.元数据?.时间) {
    // V3 格式
    游戏时间 = coerceTime(anySave.元数据.时间);
  } else if (anySave.时间) {
    游戏时间 = coerceTime(anySave.时间);
  } else if (anySave.游戏时间) {
    游戏时间 = coerceTime(anySave.游戏时间);
  }

  return { 角色名字, 境界, 位置, 游戏时间 };
}

const LEGACY_ROOT_KEYS = [
  '状态',
  '玩家角色状态',
  '玩家角色状态信息',
  '玩家角色信息',
  '角色基础信息',
  '玩家角色基础信息',
  '修行状态',
  '状态效果',
  '叙事历史',
  '对话历史',
  '任务系统',
  '事件系统',
  '宗门系统',
  '世界信息',
  '人物关系',
  '装备栏',
  '游戏时间',
  '三千大道',
  '修炼功法',
  '掌握技能',
  '身体部位开发',
] as const;

const REQUIRED_V3_KEYS = ['元数据', '角色', '社交', '世界', '系统'] as const;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const stripAIFieldsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripAIFieldsDeep);
  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === '_AI说明' || key === '_AI修改规则' || key === '_AI重要提醒') continue;
    output[key] = stripAIFieldsDeep(val);
  }
  return output;
};

const coerceTime = (value: any): GameTime => {
  const base: GameTime = { 年: 1000, 月: 1, 日: 1, 小时: 8, 分钟: 0 };
  if (!isPlainObject(value)) return base;
  return {
    年: Number(value.年 ?? value.年数 ?? base.年),
    月: Number(value.月 ?? base.月),
    日: Number(value.日 ?? base.日),
    小时: Number(value.小时 ?? base.小时),
    分钟: Number(value.分钟 ?? base.分钟),
  } as GameTime;
};

export function isSaveDataV3(saveData: SaveData | null | undefined): saveData is SaveDataV3 {
  if (!saveData || typeof saveData !== 'object') return false;
  const anySave = saveData as any;
  return (
    isPlainObject(anySave.元数据) &&
    isPlainObject(anySave.角色) &&
    isPlainObject(anySave.社交) &&
    isPlainObject(anySave.世界) &&
    isPlainObject(anySave.系统)
  );
}

export function detectLegacySaveData(saveData: SaveData | null | undefined): SaveMigrationDetection {
  if (!saveData || typeof saveData !== 'object') {
    return {
      needsMigration: true,
      issues: ['invalid-structure'],
      legacyKeysFound: [],
    };
  }

  const anySave = saveData as any;

  if (isSaveDataV3(saveData)) {
    return { needsMigration: false, issues: [], legacyKeysFound: [] };
  }

  const legacyKeysFound = [
    ...LEGACY_ROOT_KEYS.filter((k) => k in anySave),
    // “短路径平铺结构”也视为旧结构（需要迁移到 5 领域 V3）
    ...(anySave.属性 || anySave.位置 || anySave.背包 || anySave.时间 ? ['短路径平铺'] : []),
  ] as string[];

  const missingRequired = REQUIRED_V3_KEYS.filter((k) => !(k in anySave));
  const issues: SaveMigrationIssue[] = [];
  if (legacyKeysFound.length > 0) issues.push('legacy-root-keys');
  if (missingRequired.length > 0) issues.push('missing-required-keys');

  return {
    needsMigration: issues.length > 0,
    issues,
    legacyKeysFound,
  };
}

const buildDefaultEventSystem = (): EventSystem => ({
  配置: {
    启用随机事件: true,
    最小间隔年: 1,
    最大间隔年: 10,
    事件提示词: '',
  },
  下次事件时间: null,
  事件记录: [],
});

const buildDefaultMemory = (): SaveDataV3['社交']['记忆'] => ({
  短期记忆: [],
  中期记忆: [],
  长期记忆: [],
  隐式中期记忆: [],
});

const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()];
  return [];
};

const normalizeMemory = (value: unknown): SaveDataV3['社交']['记忆'] => {
  const base = buildDefaultMemory();
  if (!isPlainObject(value)) return base;

  const anyValue = value as any;
  return {
    短期记忆: coerceStringArray(anyValue.短期记忆 ?? anyValue.short_term ?? anyValue.shortTerm),
    中期记忆: coerceStringArray(anyValue.中期记忆 ?? anyValue.mid_term ?? anyValue.midTerm),
    长期记忆: coerceStringArray(anyValue.长期记忆 ?? anyValue.long_term ?? anyValue.longTerm),
    隐式中期记忆: coerceStringArray(anyValue.隐式中期记忆 ?? anyValue.implicit_mid_term ?? anyValue.implicitMidTerm),
  };
};

const buildDefaultOnline = (): SaveDataV3['系统']['联机'] => ({
  模式: '单机',
  房间ID: null,
  玩家ID: null,
  只读路径: ['世界'],
  世界曝光: false,
  冲突策略: '服务器',
});

const buildDefaultWorldInfo = (nowIso: string) => ({
  世界名称: '朝天大陆',
  大陆信息: [],
  势力信息: [],
  地点信息: [],
  生成时间: nowIso,
  世界背景: '',
  世界纪元: '',
  特殊设定: [],
  版本: 'v1',
});

const buildDefaultIdentity = () => ({
  名字: '无名修士',
  性别: '男',
  出生日期: { 年: 982, 月: 1, 日: 1 },
  种族: '人族',
  世界: '朝天大陆',
  天资: '凡人',
  出生: '散修',
  灵根: '五行杂灵根',
  天赋: [],
  先天六司: { 根骨: 5, 灵性: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 },
  后天六司: { 根骨: 0, 灵性: 0, 悟性: 0, 气运: 0, 魅力: 0, 心性: 0 },
});

/**
 * 迁移叙事状态中的角色数据格式
 * 将先天六司和后天六司合并为六司
 * 将属性中的气血、灵气、神识、寿命迁移为命基数组
 * 将背包中的物品分类转换为数组格式
 * 从社交关系中提取人物属性到独立结构
 * @param stateForAI AI状态对象
 * @returns 迁移后的角色对象和人物属性
 */
export function migrateNarrativeCharacterState(stateForAI: any): { character: any; 人物属性?: any; cleanedSocial?: any } {
  if (!stateForAI?.角色) return { character: stateForAI, 人物属性: undefined, cleanedSocial: undefined };

  const character = { ...stateForAI.角色 };
  const identity = character.身份 ? { ...character.身份 } : {};
  const attributes = character.属性 ? { ...character.属性 } : {};
  const backpack = character.背包 ? { ...character.背包 } : {};

  // 迁移1：将先天六司和后天六司转换为六司数组格式
  if (identity.先天六司 || identity.后天六司) {
    const innate = identity.先天六司 || {};
    const acquired = identity.后天六司 || {};

    // 创建六司数组，保持先天和后天分开
    const 六司 = [
      {
        属性: "先天",
        根骨: innate.根骨 || 0,
        灵性: innate.灵性 || 0,
        悟性: innate.悟性 || 0,
        气运: innate.气运 || 0,
        魅力: innate.魅力 || 0,
        心性: innate.心性 || 0,
      },
      {
        属性: "后天",
        根骨: acquired.根骨 || 0,
        灵性: acquired.灵性 || 0,
        悟性: acquired.悟性 || 0,
        气运: acquired.气运 || 0,
        魅力: acquired.魅力 || 0,
        心性: acquired.心性 || 0,
      },
    ];

    // 删除旧的字段，添加新的六司字段
    delete identity.先天六司;
    delete identity.后天六司;
    identity.六司 = 六司;
  }

  // 迁移2：将属性中的气血、灵气、神识、寿命迁移为命基数组
  if (attributes.气血 || attributes.灵气 || attributes.神识 || attributes.寿命) {
    const 命基: Array<{ 名称: string; 当前: number; 上限: number }> = [];

    // 提取气血、灵气、神识、寿命到命基数组
    if (attributes.气血 && typeof attributes.气血 === 'object') {
      命基.push({
        名称: '气血',
        当前: attributes.气血.当前 ?? 100,
        上限: attributes.气血.上限 ?? 100,
      });
      delete attributes.气血;
    }

    if (attributes.灵气 && typeof attributes.灵气 === 'object') {
      命基.push({
        名称: '灵气',
        当前: attributes.灵气.当前 ?? 50,
        上限: attributes.灵气.上限 ?? 50,
      });
      delete attributes.灵气;
    }

    if (attributes.神识 && typeof attributes.神识 === 'object') {
      命基.push({
        名称: '神识',
        当前: attributes.神识.当前 ?? 30,
        上限: attributes.神识.上限 ?? 30,
      });
      delete attributes.神识;
    }

    if (attributes.寿命 && typeof attributes.寿命 === 'object') {
      命基.push({
        名称: '寿命',
        当前: attributes.寿命.当前 ?? 18,
        上限: attributes.寿命.上限 ?? 80,
      });
      delete attributes.寿命;
    }

    // 如果有命基数据，则添加到属性中
    if (命基.length > 0) {
      attributes.命基 = 命基;
    }
  }

  // 迁移3：将背包中的物品分类转换为数组格式
  if (backpack.物品 && typeof backpack.物品 === 'object') {
    const items = backpack.物品;
    const newItems: Record<string, any> = {};
    const danArray: any[] = [];
    const itemArray: any[] = [];
    const equipArray: any[] = [];

    // 遍历所有物品
    for (const [itemKey, itemValue] of Object.entries(items)) {
      const item = itemValue as any;
      if (!item) continue;

      const itemID = item.物品ID || itemKey;

      // 功法：以 gongfa_ 开头或类型为功法的，保持为对象格式
      if (itemKey.startsWith('gongfa_') || item.类型 === '功法') {
        newItems[itemKey] = {
          ...item,
          物品ID: itemID,
        };
      }
      // 丹药：以 dan_ 开头或类型为丹药的，转为数组
      else if (itemKey.startsWith('dan_') || item.类型 === '丹药') {
        danArray.push({
          物品ID: itemID,
          名称: item.名称 || '',
          类型: item.类型 || '丹药',
          品质: formatQuality(item.品质),
          数量: item.数量 ?? 1,
          描述: item.描述 || '',
          使用效果: item.使用效果 || '',
        });
      }
      // 装备：以 equip_ 开头或类型为装备的，转为数组
      else if (itemKey.startsWith('equip_') || item.类型 === '装备') {
        equipArray.push({
          物品ID: itemID,
          名称: item.名称 || '',
          类型: item.类型 || '装备',
          品质: formatQuality(item.品质),
          数量: item.数量 ?? 1,
          描述: item.描述 || '',
          装备增幅: formatEquipBonus(item.装备增幅),
          特殊效果: item.特殊效果 || '',
          已装备: item.已装备 || false,
        });
      }
      // 普通物品：以 item_ 开头或其他类型的，转为数组
      else {
        itemArray.push({
          物品ID: itemID,
          名称: item.名称 || '',
          类型: item.类型 || '其他',
          品质: formatQuality(item.品质),
          数量: item.数量 ?? 1,
          描述: item.描述 || '',
        });
      }
    }

    // 将转换后的数据放入新结构
    if (danArray.length > 0) newItems.dan = danArray;
    if (itemArray.length > 0) newItems.item = itemArray;
    if (equipArray.length > 0) newItems.equip = equipArray;

    backpack.物品 = newItems;
  }

  // 迁移4：将货币从对象转为数组
  if (backpack.货币 && typeof backpack.货币 === 'object') {
    const currencies = backpack.货币;
    const currencyArray: any[] = [];

    for (const [currencyKey, currencyValue] of Object.entries(currencies)) {
      const currency = currencyValue as any;
      if (!currency) continue;

      currencyArray.push({
        币种: currencyKey,
        名称: currency.名称 || currencyKey,
        价值度: currency.价值度 ?? 0,
        描述: currency.描述 || '',
        图标: currency.图标 || 'Gem',
        数量: currency.数量 ?? 0,
      });
    }

    // 按价值度降序排列
    currencyArray.sort((a, b) => (b.价值度 || 0) - (a.价值度 || 0));

    backpack.货币 = currencyArray;
  }

  // 迁移5：从社交关系中提取人物属性
  const { 人物属性, cleanedSocial } = extractCharacterAttributes(stateForAI);

  return {
    character: {
      ...character,
      身份: identity,
      属性: attributes,
      背包: backpack,
    },
    人物属性,
    cleanedSocial,
  };
}

/**
 * 从社交关系中提取人物属性
 * 将灵根、先天六司、境界、属性、当前位置提取到独立结构中
 * @param stateForAI AI状态对象
 * @returns 返回 { 人物属性, cleanedSocial }
 */
function extractCharacterAttributes(stateForAI: any): { 人物属性?: any; cleanedSocial?: any } {
  const relationships = stateForAI?.社交?.关系;
  if (!relationships || typeof relationships !== 'object') {
    return { 人物属性: undefined, cleanedSocial: undefined };
  }

  // 创建社交关系的深拷贝，避免修改原始数据
  const cleanedRelationships = JSON.parse(JSON.stringify(relationships));

  const 灵根数组: any[] = [];
  const 六司数组: any[] = [];
  const 境界数组: any[] = [];
  const 命基数组: any[] = [];
  const 当前位置数组: any[] = [];

  // 遍历社交关系中的每个人物
  for (const [npcName, npcData] of Object.entries(cleanedRelationships as Record<string, unknown>)) {
    if (!npcData || typeof npcData !== 'object') continue;

    const npc = npcData as any;
    const 人物ID = npc.名字 || npc.名称 || npcName || 'unknown';

    // 提取灵根
    if (npc.灵根 && typeof npc.灵根 === 'object') {
      灵根数组.push({
        人物ID,
        名称: npc.灵根.名称 || '未知',
        品级: npc.灵根.品级 || '无',
      });
      // 提取后删除原始字段
      delete npc.灵根;
    }

    // 提取先天六司和后天六司，转换为六司数组格式
    const innate = npc.先天六司 || {};

    // 创建六司数组，只有先天
    if (Object.keys(innate).length > 0) {
      六司数组.push({
        人物ID,
        属性: "先天",
        根骨: innate.根骨 || 0,
        灵性: innate.灵性 || 0,
        悟性: innate.悟性 || 0,
        气运: innate.气运 || 0,
        魅力: innate.魅力 || 0,
        心性: innate.心性 || 0,
      });
      // 提取后删除原始字段
      delete npc.先天六司;
    }

    // 提取境界
    if (npc.境界 && typeof npc.境界 === 'object') {
      境界数组.push({
        人物ID,
        名称: npc.境界.名称 || '凡人',
        阶段: npc.境界.阶段 || '圆满',
        当前进度: npc.境界.当前进度 ?? 0,
        下一级所需: npc.境界.下一级所需 ?? 100,
        突破描述: npc.境界.突破描述 || '无',
      });
      // 提取后删除原始字段
      delete npc.境界;
    }

    // 提取属性并展平为命基
    if (npc.属性 && typeof npc.属性 === 'object') {
      const npc属性 = npc.属性;
      命基数组.push({
        人物ID,
        气血当前: npc属性.气血?.当前 ?? 100,
        气血上限: npc属性.气血?.上限 ?? 100,
        灵气当前: npc属性.灵气?.当前 ?? 50,
        灵气上限: npc属性.灵气?.上限 ?? 50,
        神识当前: npc属性.神识?.当前 ?? 30,
        神识上限: npc属性.神识?.上限 ?? 30,
        寿元上限: npc属性.寿元上限 ?? 80,
      });
      // 提取后删除原始字段
      delete npc.属性;
    }

    // 提取当前位置
    if (npc.当前位置 && typeof npc.当前位置 === 'object') {
      当前位置数组.push({
        人物ID,
        描述: npc.当前位置.描述 || '未知',
        x: npc.当前位置.x ?? 0,
        y: npc.当前位置.y ?? 0,
        灵气浓度: npc.当前位置.灵气浓度 ?? 50,
      });
      // 提取后删除原始字段
      delete npc.当前位置;
    }
  }

  // 如果没有任何人物属性数据，则返回 undefined
  if (灵根数组.length === 0 &&
      六司数组.length === 0 &&
      境界数组.length === 0 &&
      命基数组.length === 0 &&
      当前位置数组.length === 0) {
    return { 人物属性: undefined, cleanedSocial: undefined };
  }

  // 构建人物属性对象
  const 人物属性: any = {};

  if (灵根数组.length > 0) 人物属性.灵根 = 灵根数组;
  if (六司数组.length > 0) 人物属性.六司 = 六司数组;
  if (境界数组.length > 0) 人物属性.境界 = 境界数组;
  if (命基数组.length > 0) 人物属性.命基 = 命基数组;
  if (当前位置数组.length > 0) 人物属性.当前位置 = 当前位置数组;

  return {
    人物属性,
    cleanedSocial: cleanedRelationships,
  };
}

/**
 * 格式化品质对象为字符串
 */
function formatQuality(quality: any): string {
  if (!quality) return 'quality:凡,grade:1';
  if (typeof quality === 'string') return quality;
  if (typeof quality === 'object') {
    const q = quality.quality || '凡';
    const g = quality.grade || 1;
    return `quality:${q},grade:${g}`;
  }
  return 'quality:凡,grade:1';
}

/**
 * 格式化装备增幅对象为字符串
 */
function formatEquipBonus(bonus: any): string {
  if (!bonus) return '';
  if (typeof bonus === 'string') return bonus;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(bonus as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const innerParts: string[] = [];
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        innerParts.push(`${innerValue || 0}`);
      }
      if (innerParts.length > 0) {
        parts.push(`${key}.${Object.keys(value as Record<string, unknown>).join('.')}:${innerParts.join(',')}`);
      }
    } else {
      parts.push(`${key}:${value}`);
    }
  }
  return parts.join(',');
}

export function migrateSaveDataToLatest(raw: SaveData): { migrated: SaveDataV3; report: SaveMigrationReport } {
  const sourceRaw = deepClone(raw ?? ({} as any)) as any;
  const source = stripAIFieldsDeep(sourceRaw) as any;

  const report: SaveMigrationReport = {
    legacyKeysFound: [],
    removedLegacyKeys: [],
    warnings: [],
  };

  if (isSaveDataV3(source)) {
    const normalized = deepClone(source) as any;
    if (!isPlainObject(normalized.社交)) normalized.社交 = {};
    normalized.社交.记忆 = normalizeMemory(normalized.社交.记忆);
    // V3 兜底：旧版本可能仍然只有“灵石”字段而未初始化“货币”结构
    if (normalized?.角色?.背包 && typeof normalized.角色.背包 === 'object') {
      normalizeBackpackCurrencies(normalized.角色.背包);
    }
    return { migrated: normalized as SaveDataV3, report };
  }

  report.legacyKeysFound = LEGACY_ROOT_KEYS.filter((k) => k in source) as string[];

  const nowIso = new Date().toISOString();

  const flatCharacter =
    source.角色 ??
    source.角色基础信息 ??
    source.玩家角色基础信息 ??
    source.玩家角色信息 ??
    source.玩家角色状态信息?.角色 ??
    null;

  const legacyStatusLike = source.属性 ?? source.状态 ?? source.玩家角色状态 ?? source.玩家角色状态信息 ?? null;
  const legacyStatusObj = isPlainObject(legacyStatusLike) ? legacyStatusLike : ({} as any);

  const flatAttributes = {
    境界: (legacyStatusObj as any).境界 ?? null,
    声望: (legacyStatusObj as any).声望 ?? 0,
    气血: (legacyStatusObj as any).气血 ?? { 当前: 100, 上限: 100 },
    灵气: (legacyStatusObj as any).灵气 ?? { 当前: 50, 上限: 50 },
    神识: (legacyStatusObj as any).神识 ?? { 当前: 30, 上限: 30 },
    寿命: (legacyStatusObj as any).寿命 ?? { 当前: 18, 上限: 80 },
  };

  const effectsCandidate =
    source.效果 ??
    source.修行状态 ??
    (legacyStatusObj as any).状态效果 ??
    source.状态效果 ??
    [];
  const flatEffects = Array.isArray(effectsCandidate) ? effectsCandidate : [];

  const flatLocation =
    source.位置 ??
    (legacyStatusObj as any).位置 ??
    (source.状态位置 as any) ??
    { 描述: '朝天大陆·无名之地', x: 5000, y: 5000 };

  const flatTime = coerceTime(source.元数据?.时间 ?? source.时间 ?? source.游戏时间);

  const flatInventory = source.背包 ?? { 灵石: { 下品: 0, 中品: 0, 上品: 0, 极品: 0 }, 物品: {} };
  // 新货币系统迁移（兼容旧存档）
  if (flatInventory && typeof flatInventory === 'object') {
    normalizeBackpackCurrencies(flatInventory as any);
  }
  const flatEquipment =
    source.装备 ?? source.装备栏 ?? { 装备1: null, 装备2: null, 装备3: null, 装备4: null, 装备5: null, 装备6: null };

  const flatTechniqueSystem =
    source.功法 ??
    {
      当前功法ID: null,
      功法进度: {},
      功法套装: { 主修: null, 辅修: [] },
    };

  const flatCultivation =
    source.修炼 ?? (source.修炼功法 !== undefined ? { 修炼功法: source.修炼功法 } : { 修炼功法: null });

  const flatDao = source.大道 ?? source.三千大道 ?? { 大道列表: {} };
  const flatSkills =
    source.技能 ??
    (source.掌握技能
      ? { 掌握技能: source.掌握技能, 装备栏: [], 冷却: {} }
      : { 掌握技能: [], 装备栏: [], 冷却: {} });

  const flatSect = source.宗门 ?? source.宗门系统 ?? undefined;
  const flatRelationships = source.关系 ?? source.人物关系 ?? {};
  const flatMemory = normalizeMemory(source.记忆 ?? source.社交?.记忆);

  const flatEventRaw = source.事件 ?? source.事件系统 ?? buildDefaultEventSystem();
  const flatEvent = (() => {
    const eventSystem = isPlainObject(flatEventRaw)
      ? (deepClone(flatEventRaw) as any)
      : (buildDefaultEventSystem() as any);

    if (!Array.isArray(eventSystem.事件记录)) eventSystem.事件记录 = [];
    if (!isPlainObject(eventSystem.下次事件时间)) eventSystem.下次事件时间 = null;

    return eventSystem as any;
  })();

  const worldInfoCandidate = source.世界?.信息 ?? source.世界 ?? source.世界信息 ?? source.worldInfo ?? undefined;
  const worldInfo = isPlainObject(worldInfoCandidate) ? worldInfoCandidate : buildDefaultWorldInfo(nowIso);

  const systemConfig = source.系统?.配置 ?? source.系统 ?? source.系统配置 ?? undefined;

  const narrative =
    source.系统?.历史?.叙事 ??
    source.历史?.叙事 ??
    (source.叙事历史 ? source.叙事历史 : source.对话历史 ? source.对话历史 : []);

  const online =
    source.系统?.联机 ??
    source.联机 ??
    buildDefaultOnline();

  const identity = (isPlainObject(flatCharacter) ? (flatCharacter as any) : buildDefaultIdentity()) as any;
  const migrated: SaveDataV3 = {
    元数据: {
      版本号: 3,
      存档ID: String(source.元数据?.存档ID ?? source.存档ID ?? `save_${Date.now()}`),
      存档名: String(source.元数据?.存档名 ?? source.存档名 ?? '迁移存档'),
      游戏版本: source.元数据?.游戏版本 ?? source.游戏版本,
      创建时间: String(source.元数据?.创建时间 ?? source.创建时间 ?? nowIso),
      更新时间: nowIso,
      游戏时长秒: Number(source.元数据?.游戏时长秒 ?? source.游戏时长秒 ?? source.元数据?.游戏时长 ?? source.游戏时长 ?? 0),
      时间: flatTime,
    },
    角色: {
      身份: identity,
      属性: flatAttributes,
      位置: flatLocation,
      效果: flatEffects,
      身体: source.身体 ?? (source.身体部位开发 ? { 部位开发: source.身体部位开发 } : undefined),
      背包: flatInventory,
      装备: flatEquipment,
      功法: flatTechniqueSystem,
      修炼: flatCultivation,
      大道: flatDao,
      技能: flatSkills,
    },
    社交: {
      关系: flatRelationships,
      宗门: flatSect ?? null,
      事件: flatEvent,
      记忆: flatMemory,
    },
    世界: {
      信息: worldInfo as any,
      状态: source.世界?.状态 ?? source.世界状态 ?? undefined,
    },
    系统: {
      配置: systemConfig,
      设置: source.系统?.设置 ?? source.设置 ?? undefined,
      缓存: source.系统?.缓存 ?? source.缓存 ?? undefined,
      行动队列: source.系统?.行动队列 ?? source.行动队列 ?? undefined,
      历史: { 叙事: Array.isArray(narrative) ? narrative : [] },
      扩展: source.系统?.扩展 ?? source.扩展 ?? {},
      联机: isPlainObject(online) ? { ...buildDefaultOnline(), ...(online as any) } : buildDefaultOnline(),
    },
  };

  // 清除旧key：迁移后的对象严格只保留新字段
  for (const key of LEGACY_ROOT_KEYS) {
    if (key in source) report.removedLegacyKeys.push(String(key));
  }

  // 最小校验与告警
  for (const key of REQUIRED_V3_KEYS) {
    if (!(key in migrated as any)) report.warnings.push(`迁移后缺少必填字段：${String(key)}`);
  }
  if (!migrated.角色?.身份) report.warnings.push('迁移后仍缺少 角色.身份（将导致部分界面无法展示）');

  return { migrated: migrated as SaveDataV3, report };
}
