# LLM 流式输出 → UI 渲染完整流程

> 生成日期: 2026-04-19

## 概述

仙途的 LLM 输出显示分为两个阶段：**流式阶段**（AI 生成中逐字显示）和**最终阶段**（生成完成后显示清洗文本）。两个阶段通过 `isAIProcessing` 状态在模板中互斥切换。

---

## 核心机制：两个互斥渲染区域

`MainGamePanel.vue` 模板中有两个 `<div>`，通过 `v-if` / `v-else-if` 互斥显示：

```vue
<!-- 区域 A：流式输出（生成中显示，优先级最高） -->
<div v-if="isAIProcessing && streamingContent" class="streaming-narrative-content">
  <FormattedText :text="streamingContent" />        <!-- 读 uiStore.streamingContent -->
</div>

<!-- 区域 B：最终叙事（生成完成后显示） -->
<div v-else-if="currentNarrative" class="narrative-content">
  <FormattedText :text="currentNarrative.content" /> <!-- 读 gameStateStore -->
</div>
```

切换条件：`isAIProcessing` 由 `true` 变为 `false` 时，区域 A 隐藏，区域 B 激活。

---

## 阶段一：流式输出（AI 生成中）

### 1.1 用户发送消息，进入 AI 处理状态

`MainGamePanel.vue:1511-1517`

```typescript
uiStore.setAIProcessing(true);        // isAIProcessing = true → 区域 A 生效
uiStore.setStreamingContent('');       // 清空旧内容
rawStreamingContent.value = '';        // 清空原始缓冲
streamingMessageIndex.value = 1;      // 启用流式处理标记
```

此时区域 A 的 `v-if` 条件满足（`isAIProcessing=true`），但 `streamingContent` 为空，显示顶部「天道感应中...」指示器而非文本。

### 1.2 注册流式回调

根据运行模式不同，有两种注册方式：

**网页版（自定义 API）** — `MainGamePanel.vue:1542-1549`

```typescript
if (!isTavernEnvFlag) {
  resetStreamParseState();
  options.onStreamChunk = (chunk: string) => {
    if (!useStreaming.value || !chunk) return;
    handleStreamChunk(chunk);
  };
}
```

**酒馆版（Tavern 事件系统）** — `MainGamePanel.vue:2021-2043`

```typescript
globalHandlers.onStreamToken = (chunk: string, generationId: string) => {
  if (isMatchingGenerationId(generationId) && useStreaming.value && chunk) {
    rawStreamingContent.value += chunk;
    uiStore.setStreamingContent(rawStreamingContent.value);
  }
};
// 注册 SillyTavern 事件监听
eventOn(events.STREAM_TOKEN_RECEIVED_INCREMENTALLY, globalHandlers.onStreamToken);
eventOn(events.GENERATION_STARTED, globalHandlers.onGenerationStarted);
eventOn(events.GENERATION_ENDED, globalHandlers.onGenerationEnded);
```

### 1.3 SSE 流处理（网页版）

`aiService.ts:1942-2067` — `processSSEStream()` 核心流引擎

```typescript
// 获取 ReadableStream reader
const reader = response.body?.getReader();

// 逐块读取
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  // 解析 SSE 格式（data: {...}）
  const lines = buffer.split('\n');
  for (const line of lines) {
    const content = extractContent(data);  // 从 JSON 中提取文本增量
    if (content) {
      rawFullText += content;
      onStreamChunk(content);              // 立即转发，零缓冲
    }
  }
}
```

不同 AI 提供商的流式请求入口：

| 函数 | 行号 | 提供商 | 特殊处理 |
|------|------|--------|----------|
| `streamingRequestOpenAI()` | :1649 | OpenAI/DeepSeek/智谱 | DeepSeek Reasoner `reasoning_content`，智谱 GLM thinking 字段 |
| `streamingRequestClaude()` | :1785 | Claude | extended thinking 模式 |
| `streamingRequestGemini()` | :1867 | Gemini | `streamGenerateContent` 端点，thought 字段 |

### 1.4 Chunk 解析与分类

`MainGamePanel.vue:430-502` — `handleStreamChunk()` 状态机

该函数解析 `<thinking>...</thinking>` 标签，将内容分为**正文**和**思维链**两类：

```
状态: inThinking=false（正文模式）
  ├── 未找到 <thinking> → 缓冲，安全长度后作为正文输出
  └── 找到 <thinking>   → 输出标签前正文，切换 inThinking=true

状态: inThinking=true（思维链模式）
  ├── 未找到 </thinking> → 缓冲，安全长度后作为思维链输出
  └── 找到 </thinking>   → 输出标签前思维链，切换回 inThinking=false
```

分发逻辑：

```typescript
// 正文内容 → streamingContent（区域 A 显示）
uiStore.appendStreamingContent(state.buffer);       // :445

// 思维链内容 → thinkingContent（折叠区域显示）
uiStore.appendThinkingContent(state.buffer);        // :476
```

### 1.5 Store 更新

`uiStore.ts:178-183`

```typescript
function appendStreamingContent(chunk: string) {
  rawStreamingContent.value += chunk;               // 累加原始内容
  const extracted = extractTextFromJsonResponse(rawStreamingContent.value);
  streamingContent.value = extracted || sanitizeAITextForDisplay(rawStreamingContent.value);
}
```

每次调用都会更新 `streamingContent` ref，触发 Vue 响应式更新。

### 1.6 Vue 响应式驱动渲染

```
streamingContent (ref) 更新
  ↓
MainGamePanel computed: streamingContent 感知变化
  ↓
模板区域 A: v-if="isAIProcessing && streamingContent" → true
  ↓
<FormattedText :text="streamingContent" />  重新渲染
  ↓
watch(streamingContent) → nextTick → 自动滚动到底部    :2119-2128
```

自动滚动逻辑（`:2119`）：
- 用户未手动上滚 → 自动跟随到底部
- 用户手动上滚 → 不跟随（`userHasScrolledUp` 标记）

### 1.7 流式阶段 UI 状态

```
┌─────────────────────────────────────────────────┐
│  [天道感应中...] ●  142 字  [重置]              │  ← 处理指示器 :31-47
├─────────────────────────────────────────────────┤
│  🧠 思维过程 [已完成] ▼                          │  ← 思维链折叠区 :49-64
│    (可展开查看 AI 推理过程)                       │
├─────────────────────────────────────────────────┤
│  你的输入: xxx                                   │  ← 用户输入回显 :68-75
│                                                 │
│  流式文本内容在此实时渲染...                      │  ← 区域 A :67-78
│  FormattedText 组件解析富文本标记                 │
└─────────────────────────────────────────────────┘
```

---

## 阶段二：生成完成 → 最终文本显示

### 2.1 AI 生成结束，提取叙事文本

`AIBidirectionalSystem.ts:1097-1179`

分步生成模式下，两步串行执行：

```
第1步（正文生成）:
  generateOnce() → AI 原始输出
  extractNarrativeText(raw) → step1Text（纯叙事文本）     :1113
  optimizeText(step1Text) → 润色后文本（可选）             :1292

第2步（指令生成）:
  generateOnce() → AI 原始输出
  parseAIResponse() → tavern_commands + action_options     :1158
```

组装最终响应：

```typescript
gmResponse = {
  text: step1Text,                                      // extractNarrativeText 结果
  mid_term_memory: parsedStep2.mid_term_memory || '',
  tavern_commands: parsedStep2.tavern_commands || [],
  action_options: actionOptionsEnabled ? [...] : []
};
```

### 2.2 extractNarrativeText 文本清洗

`AIBidirectionalSystem.ts:303-369`

该函数从 AI 原始输出中提取纯叙事文本，处理三种情况：

**1) 清除思维链标签**（`:304-313`）

```typescript
cleaned = raw
  .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
  .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
  .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
```

支持 `<thinking>`、`<antThinking>`、`<reasoning>`、`<thought>` 等变体。

**2) JSON 格式提取 text 字段**（`:326-365`）

当 AI 返回 `{"text": "...", "tavern_commands": {...}}` 时，解析 JSON 取 `text` 字段。多层容错：

| 情况 | 处理方式 | 行号 |
|------|----------|------|
| 未闭合 JSON | 自动补全 `"}` | :329-331 |
| 内嵌引号 | 转义处理 | :334-341 |
| JSON 解析失败 | 尝试提取 markdown 代码块 | :349-354 |
| 代码块也失败 | 清洗换行后直接返回 | :356-364 |

提取的字段优先级：`text` → `叙事文本` → `narrative`（`:359`）

**3) 纯文本直接返回**（`:368`）

非 JSON 格式（如酒馆模式直接输出），清除标签后直接返回。

### 2.3 文本写入 gameStateStore

`AIBidirectionalSystem.ts:1884-1912` — `processGmResponse()` 内部

```typescript
const textContent = sanitizeAITextForDisplay(response.text || '').trim();

// 写入叙事历史
系统.历史.叙事.push({
  type: 'gm',
  content: `${timePrefix}${textContent}`,
  actionOptions: response.action_options
});

// 同时写入短期记忆
社交.记忆.短期记忆.push(`${timePrefix}${textContent}`);
```

写入后通过 `gameStateStore.loadFromSaveData()` 同步到响应式 store。

### 2.4 清除 AI 处理状态 — 切换触发点

`MainGamePanel.vue:1740-1747`

```typescript
uiStore.setAIProcessing(false);        // isAIProcessing = false ← 关键切换
uiStore.resetStreamingState();          // streamingContent = ''
rawStreamingContent.value = '';
```

`resetStreamingState()` 实现（`uiStore.ts:212-220`）：

```typescript
function resetStreamingState() {
  streamingContent.value = '';
  rawStreamingContent.value = '';
  currentGenerationId.value = null;
  streamingTimestamp.value = null;
  isAIProcessing.value = false;
  thinkingContent.value = '';
  isThinkingPhase.value = false;
}
```

**这一刻，Vue 条件渲染切换：**

```
isAIProcessing: true → false
streamingContent: "..." → ""

区域 A: v-if="isAIProcessing && streamingContent" → false → 隐藏
区域 B: v-else-if="currentNarrative"              → true  → 显示
```

### 2.5 currentNarrative 计算属性就绪

`MainGamePanel.vue:714-750`

```typescript
const currentNarrative = computed(() => {
  const shortTermMemory = gameStateStore.memory?.短期记忆;

  // 优先从短期记忆取文本（最新在末尾）
  let content = shortTermMemory[shortTermMemory.length - 1]
                  .replace(/^【.*?】\s*/, '');     // 移除时间前缀

  // 从叙事历史取 actionOptions 和 stateChanges
  const latestNarrative = narrativeHistory[narrativeHistory.length - 1];

  return {
    content,                                          // extractNarrativeText 结果
    actionOptions: latestNarrative.actionOptions,
    stateChanges: latestNarrative.stateChanges,
  };
});
```

数据来源链路：

```
extractNarrativeText(raw) → gmResponse.text
  → processGmResponse() 写入 系统.历史.叙事[] + 社交.记忆.短期记忆[]
  → gameStateStore.loadFromSaveData()
  → currentNarrative computed 重新计算
  → FormattedText :text="currentNarrative.content"
```

### 2.6 最终阶段 UI 状态

```
┌─────────────────────────────────────────────────┐
│  【子时三刻】 [⏪回退] [🔔事件] [📜变更日志 3]   │  ← 叙事元信息 :83-121
├─────────────────────────────────────────────────┤
│  你的输入: xxx                                   │  ← 用户输入回显 :124-131
│                                                 │
│  【古树参天，灵气氤氲】                           │  ← 区域 B :82-134
│  "道友请留步。"                                  │
│  `心中暗自思量`                                  │  ← FormattedText 渲染
│                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ 行动选项1 │ │ 行动选项2 │ │ 行动选项3 │           │  ← action_options :137-146
│  └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────┘
```

---

## FormattedText 富文本渲染

`FormattedText.vue:527` — `parsedText` computed 解析器

将文本解析为结构化 `TextPart[]` 数组，支持以下标记：

| 标记 | 示例 | 渲染样式 |
|------|------|----------|
| `【...】` | `【古树参天】` | 环境描写（青色） |
| `` `...` `` | `` `心中暗想` `` | 心理活动（紫色斜体） |
| `"..."` | `"请留步"` | 对话（橙色加粗） |
| `"..."` | `"道法自然"` | 引用（橙色斜体加粗） |
| `〔...〕` | `〔判定：成功〕` | 交互式判定卡片 |
| `**...**` | `**关键**` | 加粗 |
| `*...*` | `*微弱*` | 斜体 |

处理流程：
1. 文本规范化（`\n`/`\\n`/引号统一）
2. 按标记优先级逐段解析
3. 返回 `TextPart[]` 供模板渲染

---

## 双模式对比

| | 网页版（Web） | 酒馆版（Tavern） |
|---|---|---|
| 流式触发 | `aiService` 直接 SSE | SillyTavern 事件系统 |
| Chunk 来源 | `onStreamChunk` 回调 | `STREAM_TOKEN_RECEIVED_INCREMENTALLY` 事件 |
| 内容设置 | `appendStreamingContent()`（增量） | `setStreamingContent()`（整体替换） |
| thinking 解析 | `handleStreamChunk()` 状态机 | 酒馆内部处理 |
| 回调注册 | `:1542-1549` | `:2021-2043` |

---

## 完整时序图

```
用户点击发送
│
├─ uiStore.setAIProcessing(true)                          :1511
├─ uiStore.setStreamingContent('')                         :1515
│
│  ┌─── 区域 A 激活 (v-if=true) ─────────────────────────┐
│  │  显示「天道感应中...」指示器                           │
│  └─────────────────────────────────────────────────────┘
│
├─ processPlayerAction() 调用 AI                          :1563
│  │
│  │  SSE 流开始
│  │  ┌─── 循环（每个 chunk）──────────────────────────┐
│  │  │  aiService.processSSEStream() 读取 chunk       │
│  │  │    → onStreamChunk(chunk)                      │
│  │  │    → handleStreamChunk(chunk)   :1548          │
│  │  │    → uiStore.appendStreamingContent()  :445    │
│  │  │    → streamingContent 更新 (Vue 响应式)        │
│  │  │    → FormattedText 实时渲染      :77           │
│  │  │    → watch → 自动滚动到底部      :2119         │
│  │  └───────────────────────────────────────────────┘
│  │
│  │  SSE 流结束
│  │
│  │  extractNarrativeText(raw) → step1Text             :1113
│  │  optimizeText(step1Text) → 润色文本（可选）         :1292
│  │  processGmResponse() 写入:
│  │    系统.历史.叙事[] ← text                         :1898
│  │    社交.记忆.短期记忆[] ← text                     :1911
│  │  gameStateStore.loadFromSaveData() → 响应式更新
│  │
│  └─ return GM_Response { text: step1Text }
│
├─ finalText = gmResp.text                                :1621
│
├─ uiStore.setAIProcessing(false)  ← 切换触发             :1742
├─ uiStore.resetStreamingState()                           :1746
│
│  ┌─── 区域 A 隐藏 (v-if=false) ─────────────────────┐
│  └──────────────────────────────────────────────────┘
│  ┌─── 区域 B 激活 (v-else-if=true) ─────────────────┐
│  │  currentNarrative.content (computed)              │
│  │    ← gameStateStore.短期记忆[最新]                │
│  │    ← extractNarrativeText 提取的文本              │
│  │  FormattedText :text="currentNarrative.content"   │
│  └──────────────────────────────────────────────────┘
│
└─ toast.success('天机重现')                              :1734
```

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/services/aiService.ts` | SSE 流处理、多 AI 提供商适配 |
| `src/utils/AIBidirectionalSystem.ts` | AI 双向系统、`extractNarrativeText` 文本提取、`processGmResponse` 数据写入 |
| `src/components/dashboard/MainGamePanel.vue` | UI 主面板、流式渲染、状态切换 |
| `src/components/common/FormattedText.vue` | 富文本解析渲染 |
| `src/stores/uiStore.ts` | 流式状态管理（`streamingContent`、`isAIProcessing`、思维链） |
| `src/stores/gameStateStore.ts` | 游戏数据存储（叙事历史、短期记忆） |
