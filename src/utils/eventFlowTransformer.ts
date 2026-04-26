import type { GameEvent, GameTime } from '@/types/game'
import type {
  EventFlowNode,
  EventFlowEdge,
  EventFlowNodeData,
  EventFlowTransformResult,
} from '@/types/eventFlow'

/** 事件类型列表，用于 X 轴分列 */
const EVENT_TYPE_ORDER = [
  '宗门大战',
  '世界变革',
  '异宝降世',
  '秘境现世',
  '人物风波',
  '势力变动',
  '天灾人祸',
  '特殊NPC',
]

/** 布局配置 */
const LAYOUT_CONFIG = {
  columnWidth: 280,
  rowHeight: 180,
  startX: 50,
  startY: 50,
  nodeWidth: 250,
}

/** 计算游戏时间的总年数（用于排序) */
function getTotalYears(time: GameTime): number {
  return time.年 + (time.月 || 1) / 12 + (time.日 || 1) / 365
}

/** 获取事件类型的列索引 */
function getTypeColumnIndex(type: string): number {
  const index = EVENT_TYPE_ORDER.indexOf(type)
  return index >= 0 ? index : EVENT_TYPE_ORDER.length
}

/** 格式化游戏时间 */
function formatGameTime(time: GameTime | undefined): string {
  if (!time) return '未知时间'
  const year = time.年
  const month = time.月 || 1
  const day = time.日 || 1
  const hour = String(time.小时 ?? 0).padStart(2, '0')
  const minute = String(time.分钟 ?? 0).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hour}:${minute}`
}

/** 将 GameEvent 转换为 Vue Flow 节点数据 */
function eventToNodeData(event: GameEvent): EventFlowNodeData {
  return {
    eventId: event.事件ID,
    eventName: event.事件名称,
    eventType: event.事件类型,
    impactLevel: event.影响等级,
    eventSource: event.事件来源,
    time: formatGameTime(event.发生时间),
    description: event.事件描述,
    relatedPersons: event.相关人物,
    relatedFactions: event.相关势力,
    scope: event.影响范围,
  }
}

/**
 * 将事件列表转换为 Vue Flow 的节点和边
 * 布局策略:
 * - X 轴: 按事件类型分列
 * - Y 轴: 按时间排序
 */
export function transformEventsToFlow(events: GameEvent[]): EventFlowTransformResult {
  if (events.length === 0) {
    return { nodes: [], edges: [] }
  }

  // 按时间正序排列(最早在前)
  const sortedEvents = [...events].sort((a, b) => {
    return getTotalYears(a.发生时间) - getTotalYears(b.发生时间)
  })

  // 记录每个类型列中已放置的节点数量
  const columnCounts: Record<string, number> = {}

  // 创建节点
  const nodes: EventFlowNode[] = sortedEvents.map((event) => {
    const typeKey = event.事件类型 || '其他'
    const colIndex = getTypeColumnIndex(typeKey)
    const rowCount = columnCounts[typeKey] || 0
    columnCounts[typeKey] = rowCount + 1

    // 使用简化的垂直时间线布局
    // X: 按类型分列，Y: 按全局时间顺序
    const globalIndex = sortedEvents.indexOf(event)
    const x = LAYOUT_CONFIG.startX + colIndex * LAYOUT_CONFIG.columnWidth
    const y = LAYOUT_CONFIG.startY + globalIndex * LAYOUT_CONFIG.rowHeight

    return {
      id: event.事件ID,
      type: 'eventNode',
      position: { x, y },
      data: eventToNodeData(event),
      style: {
        width: `${LAYOUT_CONFIG.nodeWidth}px`,
      },
    }
  })

  // 创建边
  const edges: EventFlowEdge[] = []

  // 1. 时间线边: 连接相邻的全局事件
  for (let i = 1; i < sortedEvents.length; i++) {
    const prevEvent = sortedEvents[i - 1]
    const currEvent = sortedEvents[i]
    edges.push({
      id: `timeline-${prevEvent.事件ID}-${currEvent.事件ID}`,
      source: prevEvent.事件ID,
      target: currEvent.事件ID,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: '#6b7280',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      },
      data: { edgeType: 'timeline' },
    })
  }

  // 2. 关联边: 共享人物或势力的事件
  for (let i = 0; i < sortedEvents.length; i++) {
    for (let j = i + 2; j < sortedEvents.length; j++) {
      const eventA = sortedEvents[i]
      const eventB = sortedEvents[j]

      // 检查共享人物
      const sharedPersons =
        eventA.相关人物 &&
        eventB.相关人物 &&
        eventA.相关人物.some((p) => eventB.相关人物!.includes(p))

      // 检查共享势力
      const sharedFactions =
        eventA.相关势力 &&
        eventB.相关势力 &&
        eventA.相关势力.some((f) => eventB.相关势力!.includes(f))

      if (sharedPersons || sharedFactions) {
        edges.push({
          id: `relation-${eventA.事件ID}-${eventB.事件ID}`,
          source: eventA.事件ID,
          target: eventB.事件ID,
          type: 'bezier',
          animated: false,
          style: {
            stroke: sharedPersons ? '#ec4899' : '#14b8a6',
            strokeWidth: 1.5,
            opacity: 0.6,
          },
          data: {
            edgeType: sharedPersons ? 'shared_person' : 'shared_faction',
          },
        })
      }
    }
  }

  return { nodes, edges }
}

/** 获取适合视图的初始视口 */
export function getFitViewPadding(nodeCount: number): number {
  if (nodeCount <= 3) return 0.3
  if (nodeCount <= 10) return 0.2
  return 0.1
}
