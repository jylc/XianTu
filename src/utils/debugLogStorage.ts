/**
 * 调试日志持久化存储
 *
 * 使用 IndexedDB 按日期存储调试日志，支持查看、下载、清理。
 * 内存缓冲 + 定时批量写入，避免频繁 IO。
 */

const DB_NAME = 'DAD_DEBUG_LOG_DB';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const LOG_KEY_PREFIX = 'log_';

const BUFFER_FLUSH_INTERVAL = 5000; // 5秒刷新一次
const BUFFER_MAX_SIZE = 100; // 缓冲区最大条数

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  component: string;
  message: string;
  data?: string;
}

interface LogDayRecord {
  id: string;
  date: string;
  entries: LogEntry[];
}

let dbInstance: IDBDatabase | null = null;

// 内存缓冲区：按日期分组
const buffer: Map<string, LogEntry[]> = new Map();
let flushTimer: ReturnType<typeof setInterval> | null = null;

// ============ IndexedDB 操作 ============

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function readDayRecord(dateKey: string): Promise<LogDayRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(dateKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function writeDayRecord(record: LogDayRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============ 公开 API ============

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${LOG_KEY_PREFIX}${y}-${m}-${d}`;
}

function getTimestamp(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

/**
 * 追加一条日志到缓冲区
 */
export function appendLog(
  level: LogEntry['level'],
  component: string,
  message: string,
  data?: any
): void {
  const dateKey = getTodayKey();
  const entry: LogEntry = {
    timestamp: getTimestamp(),
    level,
    component,
    message,
    data: data !== undefined ? (typeof data === 'string' ? data : safeStringify(data)) : undefined,
  };

  if (!buffer.has(dateKey)) {
    buffer.set(dateKey, []);
  }
  buffer.get(dateKey)!.push(entry);

  // 缓冲区超过阈值时立即刷新
  let totalSize = 0;
  for (const entries of buffer.values()) totalSize += entries.length;
  if (totalSize >= BUFFER_MAX_SIZE) {
    flushBuffer();
  }
}

/**
 * 将缓冲区中的日志批量写入 IndexedDB
 */
export async function flushBuffer(): Promise<void> {
  if (buffer.size === 0) return;

  // 取出当前缓冲区内容，清空缓冲区
  const snapshot = new Map(buffer);
  buffer.clear();

  for (const [dateKey, entries] of snapshot) {
    try {
      const existing = await readDayRecord(dateKey);
      const record: LogDayRecord = existing
        ? { ...existing, entries: [...existing.entries, ...entries] }
        : { id: dateKey, date: dateKey.replace(LOG_KEY_PREFIX, ''), entries };
      await writeDayRecord(record);
    } catch (e) {
      // 写入失败时将条目放回缓冲区
      const current = buffer.get(dateKey) || [];
      buffer.set(dateKey, [...entries, ...current]);
    }
  }
}

/**
 * 启动定时刷新
 */
export function startBuffer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushBuffer().catch(() => {});
  }, BUFFER_FLUSH_INTERVAL);
}

/**
 * 停止定时刷新并写入剩余日志
 */
export async function stopBuffer(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushBuffer();
}

/**
 * 获取指定日期的日志
 */
export async function getLogsByDate(date: string): Promise<LogEntry[]> {
  const dateKey = date.startsWith(LOG_KEY_PREFIX) ? date : `${LOG_KEY_PREFIX}${date}`;
  // 先刷新该日期的缓冲区
  const buffered = buffer.get(dateKey) || [];
  await flushBuffer();
  const record = await readDayRecord(dateKey);
  const stored = record?.entries || [];
  // 合并（缓冲区已在 flush 后清空，这里用之前取出的快照）
  return [...stored, ...buffered];
}

/**
 * 获取所有有日志的日期列表（降序）
 */
export async function getAllLogDates(): Promise<string[]> {
  // 先刷新所有缓冲区
  await flushBuffer();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[])
        .filter(k => k.startsWith(LOG_KEY_PREFIX))
        .map(k => k.replace(LOG_KEY_PREFIX, ''))
        .sort()
        .reverse();
      resolve(keys);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取日志统计信息
 */
export async function getLogStats(): Promise<{ dayCount: number; totalEntries: number }> {
  await flushBuffer();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = req.result as LogDayRecord[];
      let totalEntries = 0;
      for (const r of records) {
        if (r.id.startsWith(LOG_KEY_PREFIX)) {
          totalEntries += r.entries?.length || 0;
        }
      }
      resolve({ dayCount: records.filter(r => r.id.startsWith(LOG_KEY_PREFIX)).length, totalEntries });
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 将日志条目格式化为文本行
 */
function formatEntries(entries: LogEntry[]): string {
  return entries.map(e => {
    const levelTag = `[${e.level.toUpperCase()}]`.padEnd(7);
    return `${e.timestamp} ${levelTag} [${e.component}] ${e.message}`;
  }).join('\n');
}

/**
 * 导出指定日期日志为 .log 文件并触发下载
 */
export async function exportLogToFile(date: string): Promise<void> {
  const entries = await getLogsByDate(date);
  if (entries.length === 0) return;

  const header = `===== 仙途调试日志 ${date} =====\n共 ${entries.length} 条记录\n\n`;
  const content = header + formatEntries(entries) + '\n';
  downloadFile(`xiantu-debug-${date}.log`, content);
}

/**
 * 导出全部日志为 .log 文件
 */
export async function exportAllLogs(): Promise<void> {
  await flushBuffer();
  const dates = await getAllLogDates();
  if (dates.length === 0) return;

  const parts: string[] = [`===== 仙途调试日志 - 全部导出 =====`, `共 ${dates.length} 天日志\n`];
  for (const date of dates) {
    const entries = await getLogsByDate(date);
    if (entries.length > 0) {
      parts.push(`\n===== ${date} (${entries.length} 条) =====\n`);
      parts.push(formatEntries(entries));
    }
  }
  const dateRange = dates.length > 0 ? `${dates[dates.length - 1]}~${dates[0]}` : 'all';
  downloadFile(`xiantu-debug-${dateRange}.log`, parts.join('\n'));
}

/**
 * 清理指定日期之前的日志
 */
export async function clearLogsBefore(retentionDays: number): Promise<number> {
  await flushBuffer();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const cutoffKey = `${LOG_KEY_PREFIX}${cutoffStr}`;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[]).filter(
        k => k.startsWith(LOG_KEY_PREFIX) && k < cutoffKey
      );
      let deleted = 0;
      if (keys.length === 0) { resolve(0); return; }
      for (const key of keys) {
        const delReq = store.delete(key);
        delReq.onsuccess = () => { deleted++; if (deleted === keys.length) resolve(deleted); };
        delReq.onerror = () => { deleted++; if (deleted === keys.length) resolve(deleted); };
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 清空所有日志
 */
export async function clearAllLogs(): Promise<void> {
  buffer.clear();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============ 内部工具 ============

function safeStringify(data: any): string {
  try {
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  } catch {
    return String(data);
  }
}

function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, 100);
}
