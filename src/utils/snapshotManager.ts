/**
 * 轻量级快照管理器 - 支持多次回退
 * 保存完整的存档数据，回退时整体替换
 */
import type { SaveData } from '@/types/game'

export interface Snapshot {
  id: string
  timestamp: number
  label: string
  /** 完整存档数据深拷贝 */
  data: SaveData
}

const MAX_SNAPSHOTS = 10
const snapshots = new Map<string, Snapshot[]>()

function getKey(charId: string, slot: string): string {
  return `${charId}_${slot}`
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function createSnapshot(
  charId: string,
  slot: string,
  saveData: SaveData,
  label?: string,
): void {
  const key = getKey(charId, slot)
  const list = snapshots.get(key) || []

  const time = new Date()
  const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

  // 从 V3 结构中提取记忆预览
  const shortTermMemory = (saveData as any)?.社交?.记忆?.短期记忆
  const lastMemory =
    Array.isArray(shortTermMemory) && shortTermMemory.length > 0
      ? shortTermMemory[shortTermMemory.length - 1]
      : null
  const memoryPreview =
    typeof lastMemory === 'string'
      ? lastMemory.substring(0, 15)
      : lastMemory?.内容?.substring(0, 15) || '对话'

  const snapshot: Snapshot = {
    id: `snap_${Date.now()}`,
    timestamp: Date.now(),
    label: label || `${timeStr} ${memoryPreview}`,
    data: deepClone(saveData),
  }

  list.push(snapshot)
  if (list.length > MAX_SNAPSHOTS) list.shift()
  snapshots.set(key, list)
}

export function getSnapshots(charId: string, slot: string): Snapshot[] {
  return snapshots.get(getKey(charId, slot)) || []
}

export function getSnapshot(charId: string, slot: string, id: string): Snapshot | null {
  const list = getSnapshots(charId, slot)
  return list.find((s) => s.id === id) || null
}

export function clearSnapshots(charId: string, slot: string): void {
  snapshots.delete(getKey(charId, slot))
}

export function restoreSnapshot(_currentData: SaveData, snapshot: Snapshot): SaveData {
  // 直接返回快照中的完整存档数据，确保所有字段一致
  return deepClone(snapshot.data)
}
