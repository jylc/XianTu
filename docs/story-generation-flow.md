# 故事生成与回退流程

本文档描述用户输入 → AI 生成 → 内容保存 → 回退加载的完整数据流。

---

## 一、整体流程概览

```
用户输入 / 选择行动选项
        ↓
  ┌─ sendMessage() ─────────────────────────────┐
  │  1. 校验输入 & 角色状态（气血/寿命）          │
  │  2. 备份当前状态到「上次对话」存档槽位        │
  │  3. 组装消息（用户输入 + 行动队列）           │
  │  4. 重置流式显示状态                         │
  └──────────────┬──────────────────────────────┘
                 ↓
  ┌─ AIBidirectionalSystem.processPlayerAction() ─┐
  │  1. 创建内存快照（snapshotManager）           │
  │  2. 准备 AI 上下文（移除叙事历史、短期记忆）   │
  │  3. 向量记忆检索（如启用）                    │
  │  4. 组装 Prompt（系统提示 + 游戏状态 + 输入）  │
  │  5. 调用 AI 服务生成内容                      │
  └──────────────┬──────────────────────────────┘
                 ↓
  ┌─ 流式输出 ──────────────────────────────────┐
  │  SSE 接收 chunk → handleStreamChunk()        │
  │  解析 <thinking> 标签，分别显示思维链和正文   │
  └──────────────┬──────────────────────────────┘
                 ↓
  ┌─ processGmResponse() ───────────────────────┐
  │  1. 写入叙事历史（系统.历史.叙事）            │
  │  2. 写入短期记忆（社交.记忆.短期记忆）        │
  │  3. 写入隐式中期记忆（社交.记忆.隐式中期记忆）│
  │  4. 执行 tavern_commands 修改游戏状态         │
  │  5. 短期记忆超限处理 + 自动总结触发           │
  └──────────────┬──────────────────────────────┘
                 ↓
  ┌─ 最终保存 ──────────────────────────────────┐
  │  characterStore.saveCurrentGame()             │
  │  → IndexedDB + localStorage + 云端（联机）    │
  └──────────────────────────────────────────────┘
```

---

## 二、用户输入阶段

**文件**: `src/components/dashboard/MainGamePanel.vue`

### 2.1 输入方式

| 方式 | 说明 |
|------|------|
| 手动输入 | 用户在输入框输入行动描述，Enter 发送 |
| 行动选项 | 点击 AI 生成的推荐行动，自动填入输入框 |
| 行动队列 | 来自技能面板等附加的行动指令，与用户输入合并发送 |

### 2.2 行动选项选择（约 L1488）

```typescript
const selectActionOption = (option: string) => {
  lastSelectedActionOption.value = trimmed;
  inputText.value = trimmed; // 填入输入框，用户可修改后再发送
};
```

点击选项不会直接发送，而是填入输入框，用户可编辑后按 Enter 发送。

### 2.3 消息发送入口 `sendMessage()`（约 L1501）

**前置校验**:
1. 输入非空
2. AI 未在处理中
3. 已选择角色
4. 角色未死亡（气血 > 0，年龄 < 寿元上限）

---

## 三、发送前的备份机制

**文件**: `src/components/dashboard/MainGamePanel.vue`（约 L1533）

```typescript
if (gameStateStore.conversationAutoSaveEnabled) {
  await characterStore.saveToSlot('上次对话');
}
```

在发送消息给 AI 之前，将当前游戏状态完整保存到名为「上次对话」的特殊存档槽位。这是回退功能的数据来源。

### 备份存储位置

| 存储层 | 内容 |
|--------|------|
| IndexedDB | 完整存档数据（`saveSaveData(角色ID, '上次对话', data)`） |
| Pinia Store | 存档元数据（槽位引用，不含大数据） |
| localStorage | 角色列表元信息（不含存档数据本身） |

---

## 四、消息组装

**文件**: `src/components/dashboard/MainGamePanel.vue`（约 L1544）

```
最终消息格式:

<行动趋向>{用户输入文本}

{行动队列文本（如有）}
</行动趋向>
```

- 用户输入文本：来自输入框
- 行动队列文本：来自 `actionQueueStore`，使用后清空
- `lastSentUserIntentSource`：记录输入来源（`manual` / `action_option` / `mixed`），仅用于 UI 显示

---

## 五、AI 请求与生成

### 5.1 创建内存快照

**文件**: `src/utils/AIBidirectionalSystem.ts`（约 L545）

```typescript
const { createSnapshot } = await import('@/utils/snapshotManager')
createSnapshot(active.角色ID, active.存档槽位, saveData)
```

在 AI 请求前创建一个内存快照，用于「多次回退」功能。快照保存在内存中（`Map` 结构），最多保留 10 个。

### 5.2 准备 AI 上下文（约 L579）

```typescript
const stateForAI = cloneDeep(v3)
// 移除不必要的数据以节省 token
delete stateForAI.社交.记忆.短期记忆       // 短期记忆单独发送
delete stateForAI.社交.记忆.隐式中期记忆    // 不发送给 AI
delete stateForAI.系统.历史.叙事            // 叙事历史不发送
```

### 5.3 向量记忆检索（如启用）（约 L596）

当向量记忆服务启用时：
1. 用最近 2 条短期记忆 + 用户输入作为查询
2. 检索最相关的长期记忆
3. 替换全量长期记忆，减少 token 消耗

### 5.4 Prompt 组装

**文件**: `src/utils/prompts/promptAssembler.ts`

组装后的 Prompt 结构：
```
[系统提示词]
  ├── 核心规则（世界观、角色扮演规则）
  ├── 数据定义（五域结构说明）
  ├── 行动选项规则
  ├── 事件规则
  └── CoT 推理指引（如启用）

[游戏状态] → stateForAI（V3 五域结构）

[短期记忆] → 最近 N 条短期记忆

[向量记忆] → 检索到的相关长期记忆（如启用）

[用户输入] → <行动趋向>...</行动趋向>
```

### 5.5 分步生成

**文件**: `src/utils/AIBidirectionalSystem.ts`（约 L1060）

AI 生成分为两步：

| 步骤 | 内容 | API 类型 |
|------|------|----------|
| Step 1 | 生成叙事文本（正文） | `main` |
| Step 2 | 生成指令/JSON（状态变更） | `instruction_generation` 或 `main` |

两步可使用不同的 API 配置，实现「叙事用高质量模型、指令用快速模型」的分工。

---

## 六、流式输出处理

### 6.1 流式回调设置

**文件**: `src/components/dashboard/MainGamePanel.vue`（约 L1618）

```typescript
// 非酒馆环境：设置 onStreamChunk 实时渲染
(options as any).onStreamChunk = (chunk: string) => {
  handleStreamChunk(chunk);
};
```

### 6.2 SSE 流处理

**文件**: `src/services/aiService.ts`

不同 AI 提供商的流式实现：
- **OpenAI 兼容** → `streamingRequestOpenAI()`
- **Claude** → `streamingRequestClaude()`
- **Gemini** → `streamingRequestGemini()`

统一通过 `processSSEStream()` 处理：
1. 通过 `fetch` 获取 `ReadableStream`
2. 逐行解析 SSE `data:` 行
3. 提取内容后立即调用 `onStreamChunk(chunk)` 回调
4. 拼接完整文本作为最终结果

### 6.3 前端 chunk 解析

**文件**: `src/components/dashboard/MainGamePanel.vue`（约 L482）

`handleStreamChunk()` 负责解析 `<thinking>` 标签：

```
chunk 到达
    ↓
追加到 buffer
    ↓
是否包含 <thinking>？
    ├── 是 → 之前的 buffer → streamingContent（正文）
    │        进入 thinking 模式
    │        后续内容 → thinkingContent（思维链）
    └── 否 → 继续追加到 streamingContent（正文）
    
是否包含 </thinking>？
    ├── 是 → 结束 thinking 模式
    │        后续内容继续作为正文
    └── 否 → 继续追加到 thinkingContent

空 chunk → 刷新 buffer 中剩余内容（流结束信号）
```

### 6.4 UI 实时渲染

流式内容存储在 `uiStore` 中：
- `uiStore.streamingContent` — 正在流式输出的正文
- `uiStore.thinkingContent` — 思维链内容（可折叠显示）
- 模板中通过 `FormattedText` 组件实时渲染

---

## 七、内容保存

### 7.1 AI 响应处理 `processGmResponse()`

**文件**: `src/utils/AIBidirectionalSystem.ts`（约 L2132）

AI 返回的响应被写入以下位置：

| 写入目标 | 路径 | 用途 |
|----------|------|------|
| 叙事历史 | `系统.历史.叙事[]` | UI 主面板正文展示、导出小说 |
| 短期记忆 | `社交.记忆.短期记忆[]` | AI 上下文（下次对话发送） |
| 隐式中期记忆 | `社交.记忆.隐式中期记忆[]` | 短期→中期的过渡/总结素材 |

每条叙事历史记录结构：
```typescript
{
  type: 'gm',
  role: 'assistant',
  content: '【仙道1年1月1日 08:00】正文内容...',
  time: '【仙道1年1月1日 08:00】',
  actionOptions: ['选项1', '选项2', '选项3']  // AI 生成的行动选项
}
```

### 7.2 记忆管理

**短期记忆超限处理**（约 L2267）：

```
短期记忆超过上限（默认 5 条）
    ↓
删除最旧的短期记忆（shift）
    ↓
将对应的隐式中期记忆转为正式中期记忆
    ↓
检查中期记忆是否达到自动总结阈值（默认 25 条）
    ↓
异步触发记忆总结（不阻塞游戏）
```

### 7.3 指令执行

AI 返回的 `tavern_commands`（JSON 格式）被逐条执行，修改游戏状态：
- 角色属性变更（境界突破、气血变化等）
- 物品获取/消耗
- NPC 关系变化
- 世界事件触发

### 7.4 最终持久化

**文件**: `src/components/dashboard/MainGamePanel.vue`（约 L1888）

```typescript
if (aiResponse) {
  await characterStore.saveCurrentGame();
}
```

**文件**: `src/stores/characterStore.ts`（`saveCurrentGame`）

```
gameStateStore.toSaveData()
    ↓ 获取最新游戏状态
更新寿命、技能掌握等衍生数据
    ↓
storage.saveSaveData(角色ID, 存档槽位, data)
    ↓ 存入 IndexedDB
更新存档元数据（保存时间、境界、位置）
    ↓
commitMetadataToStorage()
    ↓ 持久化到 localStorage
联机模式 → 云端同步（updateCharacterSave）
```

---

## 八、回退机制

系统提供两种回退方式：

### 8.1 「上次对话」回退（单次回退）

**触发条件**: 用户点击状态栏的回退按钮

**UI 入口**: `MainGamePanel.vue`（约 L962）
```typescript
const rollbackToLastConversation = async () => {
  // 弹出确认对话框
  uiStore.showRetryDialog({
    title: '回滚确认',
    message: '确定要回滚到上次对话前的状态吗？当前进度将被替换。',
    onConfirm: async () => {
      await characterStore.rollbackToLastConversation();
    }
  });
};
```

**回退实现**: `src/stores/characterStore.ts`（约 L2342）

```
rollbackToLastConversation()
    ↓
1. 获取「上次对话」存档数据
   ├── 内存中有 → 直接使用
   └── 内存中没有 → 从 IndexedDB 加载
    ↓
2. 深拷贝「上次对话」数据覆盖当前活跃存档
   activeSlot.存档数据 = deepClone(lastConversationData)
    ↓
3. 更新元数据（保存时间、境界、位置、游戏内时间）
    ↓
4. 触发 Pinia 响应式更新
   rootState.value.角色列表[...] = { ...更新后的存档列表 }
    ↓
5. 保存到 IndexedDB
   storage.saveSaveData(角色ID, 当前槽位, rolledBackData)
    ↓
6. 同步到 gameStateStore
   gameStateStore.loadFromSaveData(rolledBackData)
    ↓
7. 重置 UI 状态
   uiStore.resetStreamingState()
   uiStore.lastSentUserIntentText = ''
```

**效果**: 当前存档被替换为上次对话前的状态，包括叙事历史、记忆、角色属性等全部数据。

### 8.2 快照回退（多次回退）

**文件**: `src/utils/snapshotManager.ts`

每次 AI 请求前自动创建内存快照：

```typescript
export interface Snapshot {
  id: string           // 'snap_1706000000000'
  timestamp: number    // 创建时间戳
  label: string        // '4/26 14:30 修炼突破…'
  data: SaveData       // 完整存档数据深拷贝
}
```

- 存储在内存 `Map` 中（不持久化，刷新页面后丢失）
- 每个角色×存档槽位最多保留 **10 个**快照
- 按 FIFO 淘汰最旧的快照

**UI 入口**: 状态栏快照菜单，显示历史快照列表

**回退流程**（约 L1005）：

```
选择快照 → rollbackToSnapshot(snapshotId)
    ↓
1. 从 snapshots Map 中找到目标快照
2. restoreSnapshot() → 深拷贝快照数据
3. gameStateStore.loadFromSaveData(restored)
4. 清除流式显示状态
5. toast 提示「已回退到快照」
```

> 注意：快照回退只更新了 gameStateStore，没有自动保存到 IndexedDB。用户需要手动保存才能持久化。

---

## 九、数据存储位置汇总

| 数据 | 存储位置 | 持久性 |
|------|----------|--------|
| 当前存档 | IndexedDB + localStorage 元数据 | 持久 |
| 「上次对话」存档 | IndexedDB + Pinia 元数据 | 持久 |
| 内存快照 | `snapshotManager.ts` 的 `Map` | 内存（刷新丢失） |
| 叙事历史 | 存档数据内 `系统.历史.叙事` | 随存档持久化 |
| 短期/中期/长期记忆 | 存档数据内 `社交.记忆.*` | 随存档持久化 |
| 向量记忆 | IndexedDB（独立数据库） | 持久 |
| API 配置 | localStorage `api-management` | 持久 |
| UI 状态 | Pinia `uiStore` | 内存 |

---

## 十、关键文件索引

| 文件 | 职责 |
|------|------|
| `src/components/dashboard/MainGamePanel.vue` | 主面板：用户输入、流式显示、回退按钮 |
| `src/utils/AIBidirectionalSystem.ts` | AI 双向系统：Prompt 组装、AI 调用、响应处理 |
| `src/services/aiService.ts` | AI 服务层：多提供商 API 调用、SSE 流式处理 |
| `src/utils/prompts/promptAssembler.ts` | Prompt 组装器：系统提示词 + 游戏状态注入 |
| `src/utils/snapshotManager.ts` | 快照管理器：创建/获取/恢复内存快照 |
| `src/stores/characterStore.ts` | 角色存档管理：保存、加载、回退、IndexedDB 交互 |
| `src/stores/gameStateStore.ts` | 游戏状态管理：Pinia 响应式状态 |
| `src/stores/uiStore.ts` | UI 状态：流式内容、思维链、处理状态 |
| `src/stores/actionQueueStore.ts` | 行动队列：附加行动指令管理 |
