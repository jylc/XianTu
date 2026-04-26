/**
 * 轻量级快照管理器 - 支持多次回退
 * 保存完整的存档数据，回退时整体替换
 */
import type { SaveData } from '@/types/game'
import {
  saveSnapshotData,
  loadSnapshotData,
  loadSnapshotMetas,
  saveSnapshotMetas,
  deleteSnapshotEntry,
  deleteAllSnapshotsForSlot,
  type SnapshotMetaRecord,
} from '@/utils/indexedDBManager'

export interface Snapshot {
  id: string
  timestamp: number
  label: string
  /** 完整存档数据深拷贝 */
  data: SaveData
}

/** 持久化快照元数据（不含大 SaveData） */
export interface PersistentSnapshotMeta {
  id: string
  timestamp: number
  label: string
  userInput: string
  charId: string
  slotId: string
  index: number
}

const MAX_SNAPSHOTS = 10
const MAX_PERSISTENT_SNAPSHOTS = 20
const snapshots = new Map<string, Snapshot[]>()

function getKey(charId: string, slot: string): string {
  return `${charId}_${slot}`
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function generateSnapshotLabel(saveData: SaveData): string {
  const time = new Date()
  const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`

  const shortTermMemory = (saveData as any)?.社交?.记忆?.短期记忆
  const lastMemory =
    Array.isArray(shortTermMemory) && shortTermMemory.length > 0
      ? shortTermMemory[shortTermMemory.length - 1]
      : null
  const memoryPreview =
    typeof lastMemory === 'string'
      ? lastMemory.substring(0, 15)
      : lastMemory?.内容?.substring(0, 15) || '对话'

  return `${timeStr} ${memoryPreview}`
}

export function createSnapshot(
  charId: string,
  slot: string,
  saveData: SaveData,
  label?: string,
): void {
  const key = getKey(charId, slot)
  const list = snapshots.get(key) || []

  const snapshot: Snapshot = {
    id: `snap_${Date.now()}`,
    timestamp: Date.now(),
    label: label || generateSnapshotLabel(saveData),
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

// ==================== 持久化快照（IndexedDB） ====================

/**
 * 保存持久化快照到 IndexedDB
 */
export async function saveSnapshotToDB(
  charId: string,
  slotId: string,
  saveData: SaveData,
  userInput?: string,
): Promise<void> {
  try {
    const metas = await loadSnapshotMetas(charId, slotId)
    const nextIndex = metas.length > 0 ? Math.max(...metas.map((m) => m.index)) + 1 : 1

    const newMeta: SnapshotMetaRecord = {
      index: nextIndex,
      timestamp: Date.now(),
      label: generateSnapshotLabel(saveData),
      userInput: userInput || '',
    }

    // 保存完整数据
    await saveSnapshotData(charId, slotId, nextIndex, saveData)

    // 更新元数据列表
    metas.push(newMeta)

    // 超出上限时删除最旧的
    while (metas.length > MAX_PERSISTENT_SNAPSHOTS) {
      const oldest = metas.shift()!
      await deleteSnapshotEntry(charId, slotId, oldest.index)
    }

    await saveSnapshotMetas(charId, slotId, metas)
    console.log(`[快照持久化] 已保存快照 #${nextIndex}，共 ${metas.length} 条`)
  } catch (error) {
    console.error('[快照持久化] 保存失败:', error)
  }
}

/**
 * 从 IndexedDB 加载持久化快照元数据列表
 */
export async function loadSnapshotsFromDB(
  charId: string,
  slotId: string,
): Promise<PersistentSnapshotMeta[]> {
  try {
    const metas = await loadSnapshotMetas(charId, slotId)
    return metas.map((m) => ({
      id: `db_snap_${m.index}`,
      timestamp: m.timestamp,
      label: m.label,
      userInput: m.userInput || '',
      charId,
      slotId,
      index: m.index,
    }))
  } catch (error) {
    console.error('[快照持久化] 加载元数据失败:', error)
    return []
  }
}

/**
 * 从 IndexedDB 加载一条持久化快照的完整数据
 */
export async function loadSnapshotDataFromDB(
  charId: string,
  slotId: string,
  index: number,
): Promise<SaveData | null> {
  try {
    return await loadSnapshotData(charId, slotId, index)
  } catch (error) {
    console.error('[快照持久化] 加载快照数据失败:', error)
    return null
  }
}

/**
 * 从 IndexedDB 删除一条持久化快照
 */
export async function deleteSnapshotFromDB(
  charId: string,
  slotId: string,
  index: number,
): Promise<void> {
  try {
    await deleteSnapshotEntry(charId, slotId, index)
    const metas = await loadSnapshotMetas(charId, slotId)
    const filtered = metas.filter((m) => m.index !== index)
    await saveSnapshotMetas(charId, slotId, filtered)
    console.log(`[快照持久化] 已删除快照 #${index}`)
  } catch (error) {
    console.error('[快照持久化] 删除失败:', error)
  }
}

/**
 * 清除指定角色/槽位的所有持久化快照
 */
export async function clearAllSnapshotsFromDB(charId: string, slotId: string): Promise<void> {
  try {
    await deleteAllSnapshotsForSlot(charId, slotId)
  } catch (error) {
    console.error('[快照持久化] 清除全部失败:', error)
  }
}
