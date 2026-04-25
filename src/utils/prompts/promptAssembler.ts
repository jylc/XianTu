import { getPrompt, getPromptRole } from '@/services/defaultPrompts'
import { promptStorage } from '@/services/promptStorage'
import { SAVE_DATA_STRUCTURE, stripNsfwContent } from './definitions/dataDefinitions'
import { isTavernEnv } from '@/utils/tavern'
import { getNsfwSettingsFromStorage } from '@/utils/nsfw'

// 导出常用的规则常量
export { SAVE_DATA_STRUCTURE as DATA_STRUCTURE_DEFINITIONS }

/**
 * 提示词分段结构 - 按角色分组
 */
export interface PromptSection {
  key: string
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 组装最终的系统Prompt（异步版本，支持自定义提示词）
 * 动态发现 coreRequest 分类中所有已启用的提示词（含用户自创）
 */
export async function assembleSystemPromptSections(
  activePrompts: string[],
  customActionPrompt?: string,
  gameState?: any,
): Promise<PromptSection[]> {
  // 动态获取 coreRequest 分类中所有已启用的提示词 key（含自创），按排序
  const allPrompts = await promptStorage.loadAll()
  const allKeys = Object.keys(allPrompts)
  const customKeys = allKeys.filter((k) => allPrompts[k].isCustom)
  console.log(
    '[提示词组装] 总提示词数:',
    allKeys.length,
    '自创提示词:',
    customKeys.map((k) => `${k}(enabled=${allPrompts[k].enabled}, cat=${allPrompts[k].category})`),
  )
  const promptKeys = Object.entries(allPrompts)
    .filter(([_, p]) => p.category === 'coreRequest' && p.enabled)
    .sort((a, b) => {
      const oA = a[1].customOrder ?? a[1].order ?? 999
      const oB = b[1].customOrder ?? b[1].order ?? 999
      return oA - oB
    })
    .map(([key]) => key)
  console.log('[提示词组装] 选中的提示词 keys:', promptKeys)

  const tavernEnv = isTavernEnv()

  // 并行加载所有提示词内容和角色
  const loadedPrompts = await Promise.all(
    promptKeys.map(async (key) => {
      let content = await getPrompt(key)
      // 对非酒馆环境清理 NSFW 内容（仅默认提示词）
      if (!tavernEnv && (key === 'businessRules' || key === 'dataDefinitions')) {
        content = stripNsfwContent(content)
      }
      const role = await getPromptRole(key)
      return { key, role, content }
    }),
  )

  // 过滤掉空内容的提示词
  const sections: PromptSection[] = loadedPrompts.filter(
    (p): p is PromptSection => !!p.content.trim(),
  )

  // 根据激活列表来添加可选模块
  if (activePrompts.includes('actionOptions')) {
    const actionOptionsPrompt = (await getPrompt('actionOptions')).trim()
    const customPromptSection = customActionPrompt
      ? `**用户自定义要求**：${customActionPrompt}

请严格按照以上自定义要求生成行动选项。`
      : '（无特殊要求，按默认规则生成）'
    if (actionOptionsPrompt) {
      sections.push({
        key: 'actionOptions',
        role: await getPromptRole('actionOptions'),
        content: actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection),
      })
    }
  }

  if (activePrompts.includes('eventSystem')) {
    const eventRules = (await getPrompt('eventSystemRules')).trim()
    if (eventRules) {
      sections.push({
        key: 'eventSystemRules',
        role: await getPromptRole('eventSystemRules'),
        content: eventRules,
      })
    }
  }

  // NSFW 设置（酒馆端专用）- 始终以 system 角色注入
  if (tavernEnv) {
    const settingsFromStore = getNsfwSettingsFromStorage()
    const cfg = (gameState?.系统?.配置 ?? {}) as Record<string, unknown>
    const nsfwMode = typeof cfg.nsfwMode === 'boolean' ? cfg.nsfwMode : settingsFromStore.nsfwMode
    const nsfwGenderFilter =
      typeof cfg.nsfwGenderFilter === 'string'
        ? cfg.nsfwGenderFilter
        : settingsFromStore.nsfwGenderFilter
    sections.push({
      key: '_nsfw_settings',
      role: 'system',
      content: [
        '# NSFW设置（酒馆端）',
        `- nsfwMode: ${nsfwMode ? 'true' : 'false'}`,
        `- nsfwGenderFilter: ${nsfwGenderFilter}`,
        '- 当 nsfwMode=true 且 NPC性别符合过滤条件时，创建NPC必须生成完整私密信息(PrivacyProfile)',
        '- 若 NPC 已存在但私密信息缺失，需用 set 写入 社交.关系.[NPC名].私密信息 完整对象',
        '- 当 nsfwMode=false 或 性别不匹配 时，禁止生成私密信息',
      ].join('\n'),
    })
  }

  // 检测联机穿越状态，自动注入穿越场景提示词
  const onlineState = gameState?.系统?.联机 || gameState?.onlineState
  const isTraveling = onlineState?.模式 === '联机' && onlineState?.房间ID && onlineState?.穿越目标

  if (isTraveling) {
    const onlineKeys = [
      'onlineModeRules',
      'onlineTravelContext',
      'onlineWorldSync',
      'onlineInteraction',
      'onlineServerLogCommand',
    ]
    for (const onlineKey of onlineKeys) {
      const content = (await getPrompt(onlineKey)).trim()
      if (content) {
        sections.push({
          key: onlineKey,
          role: await getPromptRole(onlineKey),
          content,
        })
      }
    }
  }

  return sections
}

/**
 * 兼容旧接口：返回合并后的字符串（所有段落用分隔符连接）
 * @deprecated 优先使用 assembleSystemPromptSections
 */
export async function assembleSystemPrompt(
  activePrompts: string[],
  customActionPrompt?: string,
  gameState?: any,
): Promise<string> {
  const sections = await assembleSystemPromptSections(activePrompts, customActionPrompt, gameState)
  return sections
    .map((s) => s.content.trim())
    .filter(Boolean)
    .join('\n\n---\n\n')
}

/**
 * 将 PromptSections 转为按角色分组的注入消息列表
 * 相同角色的连续段落合并，不同角色分开注入
 */
export function sectionsToInjects(
  sections: PromptSection[],
  depth: number = 4,
  position: 'in_chat' | 'none' = 'in_chat',
): Array<{
  content: string
  role: 'system' | 'user' | 'assistant'
  depth: number
  position: 'in_chat' | 'none'
}> {
  if (sections.length === 0) return []

  const injects: Array<{
    content: string
    role: 'system' | 'user' | 'assistant'
    depth: number
    position: 'in_chat' | 'none'
  }> = []

  // 按角色分组连续段落
  let currentRole = sections[0].role
  let currentParts: string[] = [sections[0].content.trim()]

  for (let i = 1; i < sections.length; i++) {
    if (sections[i].role === currentRole) {
      currentParts.push(sections[i].content.trim())
    } else {
      injects.push({
        content: currentParts.filter(Boolean).join('\n\n---\n\n'),
        role: currentRole,
        depth,
        position,
      })
      currentRole = sections[i].role
      currentParts = [sections[i].content.trim()]
    }
  }

  // 添加最后一组
  if (currentParts.length > 0) {
    injects.push({
      content: currentParts.filter(Boolean).join('\n\n---\n\n'),
      role: currentRole,
      depth,
      position,
    })
  }

  return injects
}
