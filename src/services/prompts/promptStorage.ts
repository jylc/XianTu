/**
 * 提示词存储服务 - 使用IndexedDB
 * 支持默认提示词（代码定义）和自创提示词（用户创建）
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { getSystemPrompts, PROMPT_CATEGORIES, type PromptDefinition } from './defaultPrompts'

interface PromptsDB extends DBSchema {
  prompts: {
    key: string
    value: {
      key: string
      content: string
      modified: boolean
      enabled: boolean
      weight?: number
      role?: 'system' | 'user' | 'assistant'
      customOrder?: number
      userOverrideSplit?: boolean
      // 自创提示词元数据
      isCustom?: boolean
      customName?: string
      customDescription?: string
      customCategory?: string
      updatedAt: string
    }
  }
}

export interface PromptItem {
  key: string
  name: string
  content: string
  modified: boolean
  enabled: boolean
  default: string
  category: string
  description?: string
  order?: number
  weight?: number
  condition?: 'onlineMode' | 'splitGeneration' | 'eventSystem' | 'always'
  role: 'system' | 'user' | 'assistant'
  customOrder?: number
  isCustom?: boolean
  userOverrideSplit?: boolean
}

export interface PromptsByCategory {
  [category: string]: {
    info: {
      name: string
      description: string
      icon: string
    }
    prompts: PromptItem[]
  }
}

export interface CreateCustomPromptOpts {
  name: string
  content: string
  category?: string
  description?: string
  weight?: number
  role?: 'system' | 'user' | 'assistant'
}

class PromptStorage {
  private db: IDBPDatabase<PromptsDB> | null = null

  async init() {
    if (this.db) return
    this.db = await openDB<PromptsDB>('dad-prompts', 3, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('prompts')) {
          db.createObjectStore('prompts', { keyPath: 'key' })
        }
        // v2→v3: 新字段 isCustom/customName/customDescription/customCategory 均为可选，无需迁移
      },
    })
  }

  /**
   * 加载所有提示词（默认 + 自创），平铺结构
   */
  async loadAll(): Promise<Record<string, PromptItem>> {
    await this.init()
    const defaults = getSystemPrompts()
    const result: Record<string, PromptItem> = {}

    // 1. 加载默认提示词
    for (const key in defaults) {
      const saved = await this.db!.get('prompts', key)
      const currentContent = saved?.content || defaults[key].content
      const isEnabled = saved?.enabled !== false
      const currentWeight = saved?.weight !== undefined ? saved.weight : defaults[key].weight
      const currentRole = saved?.role || defaults[key].role || 'system'
      const currentCustomOrder = saved?.customOrder
      result[key] = {
        key,
        name: defaults[key].name,
        content: currentContent,
        modified: !!saved && saved.content !== defaults[key].content,
        enabled: isEnabled,
        default: defaults[key].content,
        category: defaults[key].category,
        description: defaults[key].description,
        order: defaults[key].order,
        weight: currentWeight,
        condition: defaults[key].condition,
        role: currentRole,
        customOrder: currentCustomOrder,
        isCustom: false,
        userOverrideSplit: saved?.userOverrideSplit || false,
      }
    }

    // 2. 加载自创提示词（IDB 中 isCustom=true 但不在 defaults 中的记录）
    const allSaved = await this.db!.getAll('prompts')
    for (const saved of allSaved) {
      if (saved.isCustom && !defaults[saved.key]) {
        result[saved.key] = {
          key: saved.key,
          name: saved.customName || saved.key,
          content: saved.content,
          modified: true,
          enabled: saved.enabled !== false,
          default: '',
          category: saved.customCategory || 'coreRequest',
          description: saved.customDescription || '用户自定义提示词',
          order: saved.customOrder ?? 999,
          weight: saved.weight ?? 5,
          role: saved.role || 'system',
          customOrder: saved.customOrder,
          isCustom: true,
          userOverrideSplit: saved.userOverrideSplit || false,
        }
      }
    }

    return result
  }

  /**
   * 按分类加载所有提示词（支持条件标记）
   */
  async loadByCategory(filterOptions?: {
    isOnlineMode?: boolean
    isSplitGeneration?: boolean
    isEventSystemEnabled?: boolean
  }): Promise<PromptsByCategory> {
    await this.init()
    const allPrompts = await this.loadAll()
    const result: PromptsByCategory = {}

    // 初始化分类
    for (const [categoryKey, categoryInfo] of Object.entries(PROMPT_CATEGORIES)) {
      result[categoryKey] = {
        info: categoryInfo,
        prompts: [],
      }
    }

    for (const key in allPrompts) {
      const prompt = allPrompts[key]

      if (filterOptions && prompt.condition) {
        if (prompt.condition === 'onlineMode' && !filterOptions.isOnlineMode) continue
        if (prompt.condition === 'eventSystem' && !filterOptions.isEventSystemEnabled) continue
      }

      const category = prompt.category
      if (result[category]) {
        result[category].prompts.push(prompt)
      } else {
        const firstCategory = Object.keys(result)[0]
        if (firstCategory) {
          result[firstCategory].prompts.push(prompt)
        }
      }
    }

    for (const category in result) {
      result[category].prompts.sort((a, b) => {
        const orderA = a.customOrder !== undefined ? a.customOrder : a.order || 999
        const orderB = b.customOrder !== undefined ? b.customOrder : b.order || 999
        return orderA - orderB
      })
    }

    return result
  }

  /**
   * 创建自创提示词
   * @returns 新创建的提示词 key
   */
  async createCustom(opts: CreateCustomPromptOpts): Promise<string> {
    await this.init()
    const key = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    await this.db!.put('prompts', {
      key,
      content: opts.content,
      modified: true,
      enabled: true,
      weight: opts.weight ?? 5,
      role: opts.role || 'system',
      isCustom: true,
      customName: opts.name,
      customDescription: opts.description || '',
      customCategory: opts.category || 'coreRequest',
      updatedAt: new Date().toISOString(),
    })
    return key
  }

  /**
   * 删除提示词
   * - 自创提示词：直接删除
   * - 默认提示词：不可删除，返回 false
   */
  async deletePrompt(key: string): Promise<boolean> {
    await this.init()
    const defaults = getSystemPrompts()
    if (defaults[key]) {
      // 默认提示词不可删除
      return false
    }
    await this.db!.delete('prompts', key)
    return true
  }

  /**
   * 更新自创提示词的元数据（名称、描述等）
   */
  async updateCustomMeta(
    key: string,
    meta: { name?: string; description?: string; category?: string },
  ): Promise<void> {
    await this.init()
    const saved = await this.db!.get('prompts', key)
    if (!saved) return
    await this.db!.put('prompts', {
      ...saved,
      customName: meta.name ?? saved.customName,
      customDescription: meta.description ?? saved.customDescription,
      customCategory: meta.category ?? saved.customCategory,
      updatedAt: new Date().toISOString(),
    })
  }

  async save(
    key: string,
    content: string,
    enabled: boolean = true,
    weight?: number,
    role?: 'system' | 'user' | 'assistant',
    customOrder?: number,
  ) {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)
    const currentRole = role ?? saved?.role ?? defaults[key]?.role ?? 'system'
    const currentCustomOrder = customOrder ?? saved?.customOrder
    await this.db!.put('prompts', {
      key,
      content,
      modified: true,
      enabled,
      weight,
      role: currentRole,
      customOrder: currentCustomOrder,
      // 保留自创提示词标记和用户手动覆盖标记
      isCustom: saved?.isCustom,
      customName: saved?.customName,
      customDescription: saved?.customDescription,
      customCategory: saved?.customCategory,
      userOverrideSplit: saved?.userOverrideSplit || false,
      updatedAt: new Date().toISOString(),
    })
  }

  async setEnabled(key: string, enabled: boolean) {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)
    const content = saved?.content || defaults[key]?.content || ''
    const modified = saved?.modified || false

    await this.db!.put('prompts', {
      key,
      content,
      modified,
      enabled,
      weight: saved?.weight,
      role: saved?.role ?? defaults[key]?.role ?? 'system',
      customOrder: saved?.customOrder,
      userOverrideSplit: true,
      isCustom: saved?.isCustom,
      customName: saved?.customName,
      customDescription: saved?.customDescription,
      customCategory: saved?.customCategory,
      updatedAt: new Date().toISOString(),
    })
  }

  async setRole(key: string, role: 'system' | 'user' | 'assistant') {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)
    const content = saved?.content || defaults[key]?.content || ''
    const enabled = saved?.enabled !== false
    const modified = saved?.modified || false

    await this.db!.put('prompts', {
      key,
      content,
      modified,
      enabled,
      weight: saved?.weight,
      role,
      customOrder: saved?.customOrder,
      isCustom: saved?.isCustom,
      customName: saved?.customName,
      customDescription: saved?.customDescription,
      customCategory: saved?.customCategory,
      userOverrideSplit: saved?.userOverrideSplit || false,
      updatedAt: new Date().toISOString(),
    })
  }

  async setCustomOrders(orders: Record<string, number>) {
    await this.init()
    const defaults = getSystemPrompts()

    for (const [key, customOrder] of Object.entries(orders)) {
      const saved = await this.db!.get('prompts', key)
      const content = saved?.content || defaults[key]?.content || ''
      const enabled = saved?.enabled !== false
      const modified = saved?.modified || false

      await this.db!.put('prompts', {
        key,
        content,
        modified,
        enabled,
        weight: saved?.weight,
        role: saved?.role ?? defaults[key]?.role ?? 'system',
        customOrder,
        isCustom: saved?.isCustom,
        customName: saved?.customName,
        customDescription: saved?.customDescription,
        customCategory: saved?.customCategory,
        userOverrideSplit: saved?.userOverrideSplit || false,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  async syncEnabledToSplitMode(splitEnabled: boolean): Promise<void> {
    await this.init()
    const defaults = getSystemPrompts()
    const allSaved = await this.loadAll()

    const splitKeys = new Set(
      Object.keys(defaults).filter((key) => defaults[key].condition === 'splitGeneration'),
    )
    const coreNonSplitKeys = Object.keys(defaults).filter(
      (key) => defaults[key].category === 'coreRequest' && !splitKeys.has(key),
    )

    if (splitEnabled) {
      for (const key of splitKeys) {
        const saved = allSaved[key]
        if (saved?.userOverrideSplit) continue
        await this.setEnabledOnly(key, true)
      }
      for (const key of coreNonSplitKeys) {
        const saved = allSaved[key]
        if (saved?.userOverrideSplit) continue
        await this.setEnabledOnly(key, false)
      }
      // 自创提示词也按分步模式禁用
      for (const key in allSaved) {
        if (allSaved[key].isCustom && allSaved[key].category === 'coreRequest') {
          if (allSaved[key].userOverrideSplit) continue
          await this.setEnabledOnly(key, false)
        }
      }
    } else {
      for (const key of splitKeys) {
        const saved = allSaved[key]
        if (saved?.userOverrideSplit) continue
        await this.setEnabledOnly(key, false)
      }
      for (const key of coreNonSplitKeys) {
        const saved = allSaved[key]
        if (saved?.userOverrideSplit) continue
        await this.setEnabledOnly(key, true)
      }
      // 关闭分步时恢复自创提示词
      for (const key in allSaved) {
        if (allSaved[key].isCustom && allSaved[key].category === 'coreRequest') {
          if (allSaved[key].userOverrideSplit) continue
          await this.setEnabledOnly(key, true)
        }
      }
    }
  }

  private async setEnabledOnly(key: string, enabled: boolean): Promise<void> {
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)
    await this.db!.put('prompts', {
      key,
      content: saved?.content || defaults[key]?.content || '',
      modified: saved?.modified || false,
      enabled,
      weight: saved?.weight,
      role: saved?.role ?? defaults[key]?.role ?? 'system',
      customOrder: saved?.customOrder,
      userOverrideSplit: false,
      isCustom: saved?.isCustom,
      customName: saved?.customName,
      customDescription: saved?.customDescription,
      customCategory: saved?.customCategory,
      updatedAt: new Date().toISOString(),
    })
  }

  async getEnabledPrompts(): Promise<string[]> {
    const allPrompts = await this.loadAll()
    return Object.keys(allPrompts).filter((key) => allPrompts[key].enabled)
  }

  async get(key: string): Promise<string> {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)

    if (saved?.enabled === false) {
      return ''
    }

    // 自创提示词：直接从 IDB 读取
    if (saved?.isCustom) {
      return saved.content || ''
    }

    // 默认提示词：优先用户修改，否则用最新默认
    if (saved?.modified) {
      return saved.content
    }

    return defaults[key]?.content || ''
  }

  /**
   * 获取提示词内容（忽略 enabled 状态）
   * 用于分步生成等场景，某些提示词必须读取内容而不受 enabled 开关影响
   */
  async getContentForce(key: string): Promise<string> {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)

    if (saved?.modified) {
      return saved.content
    }

    return defaults[key]?.content || ''
  }

  async getRole(key: string): Promise<'system' | 'user' | 'assistant'> {
    await this.init()
    const defaults = getSystemPrompts()
    const saved = await this.db!.get('prompts', key)
    return saved?.role || defaults[key]?.role || 'system'
  }

  async reset(key: string) {
    await this.init()
    await this.db!.delete('prompts', key)
  }

  async resetAll() {
    await this.init()
    await this.db!.clear('prompts')
  }

  async exportAll(): Promise<Record<string, string>> {
    const allPrompts = await this.loadAll()
    const result: Record<string, string> = {}
    for (const key in allPrompts) {
      result[key] = allPrompts[key].content
    }
    return result
  }

  async importPrompts(data: Record<string, string>): Promise<number> {
    await this.init()
    const defaults = getSystemPrompts()
    let importCount = 0

    for (const key in data) {
      if (defaults[key]) {
        await this.save(key, data[key])
        importCount++
      }
    }

    return importCount
  }
}

export const promptStorage = new PromptStorage()
