# 分步生成（Split Generation）完整流程

> 生成日期: 2026-04-23

## 概述

**分步生成**是仙途的一项 AI 生成策略。开启后，原本一次 AI 调用完成的「正文 + 指令」被拆分为两步串行执行：

| 步骤 | 输出 | 说明 |
|------|------|------|
| **第1步** — 正文生成 | `{"text":"叙事正文"}` | 仅生成 400-800 字叙事文本 |
| **第2步** — 指令生成 | `{"mid_term_memory":"...","tavern_commands":[...],"action_options":[...]}` | 基于第1步正文生成数据指令 |

**核心优势**：
- 降低单次 AI 输出压力，提升正文和指令质量
- 两步可使用不同的 API（主 API 生成正文，独立 API 生成指令）
- 第2步可独立控制是否开启流式

---

## 1. 用户开启分步生成

### 1.1 UI 入口

`APIManagementPanel.vue:393-404`

```vue
<div class="setting-item">
  <label class="setting-name">{{ t('分步生成') }}</label>
  <span class="setting-desc">{{ t('开启后AI分两步生成：先输出正文，再生成指令') }}</span>
  <input type="checkbox" v-model="splitResponseGeneration" @change="saveSplitResponseSetting" />
</div>
```

### 1.2 设置存储

**存储位置**：`localStorage` → `dad_game_settings`  
**属性名**：`splitResponseGeneration`  
**默认值**：`false`（关闭）

```typescript
// APIManagementPanel.vue:717-721
const saveSplitResponseSetting = () => {
  saveGameSettings({
    splitResponseGeneration: splitResponseGeneration.value,
  });
};
```

### 1.3 附加配置

`apiManagementStore.ts:117-119`

```typescript
const aiGenerationSettings = ref({
  splitStep2Streaming: false,  // 第2步是否使用流式传输（默认关闭）
});
```

---

## 2. 核心入口：processPlayerAction()

`AIBidirectionalSystem.ts:467-1400`

### 2.1 读取分步生成开关

`:952-974`

```typescript
const isSplitEnabled = (() => {
  if (typeof options?.splitResponseGeneration === 'boolean')
    return options.splitResponseGeneration;
  try {
    const raw = localStorage.getItem('dad_game_settings');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.splitResponseGeneration === true;
  } catch {
    return false;
  }
})();

// 获取指令生成 API 配置
const apiStore = useAPIManagementStore();
const instructionApiConfig = apiStore.getAPIForType('instruction_generation');
const hasInstructionApi = instructionApiConfig && instructionApiConfig.id !== 'default';

// 最终决策：只根据开关判断
const shouldActuallySplit = isSplitEnabled;
```

### 2.2 分支路由

`:977`

```typescript
if (shouldActuallySplit) {
  // ===== 分步生成模式 =====
  // 第1步 → 正文
  // 第2步 → 指令
} else if (tavernHelper) {
  // ===== 酒馆单步模式 =====
} else {
  // ===== 自定义API单步模式 =====
}
```

---

## 3. 提示词组装

### 3.1 buildSplitSystemPrompt(1) — 第1步提示词

`:982-1014`

**目标**：仅生成叙事正文，不涉及指令。

```
组装结构：
├── splitGenerationStep1 提示词（输出格式 + 正文要求 + 严禁项）
├── 判定系统（textFormatRules）
├── 世界观设定（worldStandards）
├── 核心状态摘要（coreStatusSummary）
├── 向量记忆（vectorMemorySection，如有）
└── 游戏状态 TOON（精简版，仅用于叙事判定）
```

**注入规则**（`:1057-1073`）：
- 注入系统提示词（depth=4）
- **注入短期记忆**（depth=2）— 第1步需要上文衔接
- 注入 `</input>` 标记（depth=0）

### 3.2 buildSplitSystemPrompt(2) — 第2步提示词

`:1017-1054`

**目标**：基于第1步正文生成数据指令（mid_term_memory + tavern_commands + action_options）。

```
组装结构：
├── splitGenerationStep2 提示词（CoT 自检清单 + 输出格式 + 严禁项）
├── 业务规则（businessRules）
├── 数据定义（dataDefinitions）
├── 文本格式规则（textFormatRules）
├── 世界观设定（worldStandards）
├── 行动选项（actionOptions，如启用）
├── 事件系统规则（eventSystemRules）
├── 核心状态摘要（coreStatusSummary）
├── 聚焦NPC（focusedNpcPrompt，如有）
└── 游戏状态 TOON（完整版）
```

**注入规则**：
- 注入系统提示词（depth=4）
- **不注入短期记忆** — 避免与第1步正文重复
- 注入 `</input>` 标记（depth=0）

### 3.3 对比：单步 vs 分步提示词

| 模块 | 单步 | 分步第1步 | 分步第2步 |
|------|------|-----------|-----------|
| coreOutputRules | ✅ | ❌ | ❌ |
| businessRules | ✅ | ❌ | ✅ |
| dataDefinitions | ✅ | ❌ | ✅ |
| textFormatRules | ✅ | ✅ | ✅ |
| worldStandards | ✅ | ✅ | ✅ |
| actionOptions | ✅ | ❌ | ✅ |
| eventSystemRules | ✅ | ❌ | ✅ |
| 短期记忆注入 | ✅ | ✅ | ❌ |
| 游戏状态 | 完整 | 精简版 | 完整 |

---

## 4. 提示词模板

所有模板定义在 `src/services/prompts/defaultPrompts.ts`。

### 4.1 splitGenerationStep1（分步正文）

`:394-446` — `category: 'coreRequest'`, `condition: 'splitGeneration'`

**输出格式**：
```json
{"text":"400-800字叙事正文（重要场景可到1000字）"}
```

**关键规则**：
- 只输出 `text` 字段，禁止 `mid_term_memory` / `tavern_commands` / `action_options`
- 禁止 `<thinking>` 标签
- 禁止指令/命令相关内容
- 文本换行使用 `\n`

### 4.2 splitGenerationStep2（分步指令）

`:447-519` — `category: 'coreRequest'`, `condition: 'splitGeneration'`

**输出格式**：
```json
{
  "mid_term_memory": "50-100字摘要",
  "tavern_commands": [
    {"action": "add", "key": "元数据.时间.分钟", "value": 30}
  ],
  "action_options": ["选项1", "选项2", "选项3", "选项4", "选项5"]
}
```

**CoT 自检清单**（已合并到提示词中）：
- 基础同步：位置、时间、货币、物品
- 修炼与突破：境界进度、功法熟练度
- 战斗与消耗：灵气、气血、NPC属性
- NPC交互：出场、好感度、记忆、状态

**严禁**：
- 禁止 `text` 字段（正文已在第1步完成）
- 禁止 `<thinking>` 标签
- 禁止 JSON 以外的内容

---

## 5. 两步串行执行流程

### 5.1 第1步：正文生成

`:1097-1124`

```
processPlayerAction()
  │
  ├── buildSplitSystemPrompt(1)         → 组装第1步系统提示词
  ├── buildSplitInjects(prompt, true)   → 构建注入（含短期记忆）
  │
  └── for attempt = 1 to 2:
        ├── generateOnce({              → 调用 AI
        │     user_input: 用户输入,
        │     should_stream: useStreaming,
        │     usageType: 'main',        → 始终使用主 API
        │     onStreamChunk: 流式回调,  → 支持实时显示
        │   })
        │
        └── extractNarrativeText(raw)   → 提取纯叙事文本
              → 成功则 break
              → 失败则重试（最多2次）
```

**API 调用**：
- `usageType: 'main'` — 始终使用主 API
- `should_stream: useStreaming` — 跟随全局流式开关
- `onStreamChunk` — 前端实时渲染回调

### 5.2 第2步：指令生成

`:1126-1169`

**用户输入构造**（`:1131-1139`）：

```typescript
const step2UserInput = `
【用户本次操作】
${finalUserInput}

【第1步正文】
${step1Text}

请按"分步生成（第2步）"规则输出 JSON。
`.trim();
```

> 第2步的用户输入 = 原始用户操作 + 第1步生成的正文，使指令生成有完整上下文。

**执行流程**：

```
第1步完成 → step1Text 可用
  │
  ├── buildSplitSystemPrompt(2)         → 组装第2步系统提示词
  ├── buildSplitInjects(prompt, false)  → 构建注入（不含短期记忆）
  │
  ├── step2Streaming 独立控制:
  │     = splitStep2Streaming && useStreaming
  │
  ├── step2UsageType 独立选择:
  │     = hasInstructionApi ? 'instruction_generation' : 'main'
  │
  └── for attempt = 1 to 2:
        ├── generateOnce({              → 调用 AI
        │     user_input: 用户操作+第1步正文,
        │     should_stream: step2Streaming,
        │     usageType: step2UsageType,
        │     onStreamChunk: undefined, → 第2步不做实时渲染
        │   })
        │
        └── parseAIResponse(raw)        → 解析指令 JSON
              → tavern_commands.length > 0 则 break
              → 否则重试（最多2次）
```

**关键配置**：
- `step2Streaming`：由 `splitStep2Streaming` 独立控制，默认关闭
- `step2UsageType`：如有独立 `instruction_generation` API 则使用，否则用主 API
- `onStreamChunk`：始终为 `undefined`，第2步不做前端实时渲染

### 5.3 响应合并

`:1170-1179`

```typescript
if (!parsedStep2) {
  // 第2步全部失败，使用空值兜底
  parsedStep2 = { text: '', mid_term_memory: '', tavern_commands: [], action_options: [] };
}

gmResponse = {
  text: step1Text,                                          // ← 第1步
  mid_term_memory: parsedStep2.mid_term_memory || '',       // ← 第2步
  tavern_commands: parsedStep2.tavern_commands || [],       // ← 第2步
  action_options: actionOptionsEnabled
    ? this.sanitizeActionOptionsForDisplay(parsedStep2.action_options || [])
    : []                                                    // ← 第2步
};
```

合并后的 `gmResponse` 与单步模式输出结构完全一致，后续处理流程统一。

---

## 6. 开局生成（分步模式）

`AIBidirectionalSystem.ts:1430-1640` — `generateInitialMessage()`

开局生成同样支持分步模式，使用独立的提示词模板。

### 6.1 开局提示词模板

| 模板 | 行号 | 用途 |
|------|------|------|
| `splitInitStep1` | `:521-557` | 开局正文：600-1000字第三人称修仙正剧风 |
| `splitInitStep2` | `:564-597` | 开局指令：含角色属性初始化、世界设定、酒馆身体数据（Tavern） |

### 6.2 开局第1步

`:1542-1557`

```typescript
const step1Raw = await generateOnce({
  step: 1,
  system: await buildInitialSplitSystemPrompt(1),  // splitInitStep1 + worldStandards + 角色设定
  user: userPrompt,
  should_stream: useStreaming,
  usageType: 'main',
  onStreamChunk: options?.onStreamChunk,
});
const step1Text = this.extractNarrativeText(String(step1Raw));
```

**开局第1步提示词结构**：
```
├── splitInitStep1（输出格式 + 开局正文要求）
├── 世界观设定（worldStandards）
└── 角色设定（userPrompt）
```

### 6.3 开局第2步

`:1559-1598`

```typescript
const step2UserPrompt = `
【开局用户提示】
${userPrompt}

【第1步正文】
${step1Text}

请按"分步生成（开局-第2步）"规则输出 JSON。
`.trim();
```

**开局第2步提示词结构**：
```
├── splitInitStep2（CoT 自检清单 + 输出格式）
├── 酒馆身体数据要求（仅 Tavern 模式）
├── 业务规则（businessRules）
├── 数据定义（dataDefinitions）
├── 文本格式规则（textFormatRules）
└── 世界观设定（worldStandards）
```

**酒馆特殊要求**（`:1498-1503`）：
```
酒馆端必须生成身体数据：
- set `角色.身体` {身高,体重,体脂率,三围,肤色,发色,瞳色,...}
- 根据角色性别/年龄/种族填写合理数值
```

---

## 7. API 路由机制

### 7.1 generateOnce 封装

`:1076-1086`

```typescript
const generateOnce = async (args) => {
  return await aiService.generate({
    user_input: args.user_input,
    should_stream: args.should_stream,
    generation_id: args.generation_id,
    usageType: args.usageType || 'main',
    injects: args.injects,
    onStreamChunk: args.onStreamChunk,
  });
};
```

### 7.2 API 选择策略

| 步骤 | usageType | 说明 |
|------|-----------|------|
| 第1步（正文） | `'main'` | 始终使用主 API |
| 第2步（指令） | `'instruction_generation'` 或 `'main'` | 有独立API则用独立，否则用主API |

通过 `apiManagementStore.getAPIForType('instruction_generation')` 检查是否配置了独立的指令生成 API。

---

## 8. 错误处理与重试

### 8.1 重试策略

两步各自独立重试，每步最多 **2次**（首次 + 1次重试）：

```
第1步重试条件：
  - extractNarrativeText 返回空文本 → 重试
  - API 调用异常 → 重试
  - 用户主动取消 → 立即抛出，不重试

第2步重试条件：
  - tavern_commands 数组为空 → 重试（强制 parsedStep2 = null）
  - API 调用异常 → 重试
  - 用户主动取消 → 立即抛出，不重试
```

### 8.2 兜底机制

```typescript
// 第1步全部失败
step1Text = '';  // 空文本

// 第2步全部失败
parsedStep2 = { text: '', mid_term_memory: '', tavern_commands: [], action_options: [] };

// 最终合并仍会执行，gmResponse.text 可能为空
// 后续流程会检测到空文本并提示用户
```

### 8.3 用户取消检测

`:1088-1095`

```typescript
const isUserAbortError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('取消') || msg.includes('abort') || msg.includes('cancelled');
  }
  return false;
};
```

---

## 9. 完整时序图

### 9.1 主对话流程

```
用户发送消息
│
├── processPlayerAction()
│   │
│   ├── isSplitEnabled = localStorage.dad_game_settings.splitResponseGeneration
│   ├── shouldActuallySplit = isSplitEnabled
│   │
│   │   ┌─── shouldActuallySplit = true ──────────────────────────────┐
│   │   │                                                             │
│   │   │  第1步：正文生成                                             │
│   │   │  ├── buildSplitSystemPrompt(1)                              │
│   │   │  │   ├── splitGenerationStep1 提示词                        │
│   │   │  │   ├── textFormatRules（判定系统）                         │
│   │   │  │   ├── worldStandards                                     │
│   │   │  │   └── 游戏状态 TOON（精简版）                              │
│   │   │  ├── buildSplitInjects(prompt, includeShortTermMemory=true) │
│   │   │  │                                                          │
│   │   │  └── generateOnce({                                         │
│   │   │        user_input: 用户输入,                                  │
│   │   │        usageType: 'main',                                   │
│   │   │        onStreamChunk: 前端流式渲染回调                        │
│   │   │      })                                                      │
│   │   │        → extractNarrativeText(raw) → step1Text               │
│   │   │                                                             │
│   │   │  第2步：指令生成                                             │
│   │   │  ├── buildSplitSystemPrompt(2)                              │
│   │   │  │   ├── splitGenerationStep2 提示词（含 CoT 自检清单）       │
│   │   │  │   ├── businessRules                                      │
│   │   │  │   ├── dataDefinitions                                    │
│   │   │  │   ├── textFormatRules                                    │
│   │   │  │   ├── worldStandards                                     │
│   │   │  │   ├── actionOptions（如启用）                             │
│   │   │  │   ├── eventSystemRules                                   │
│   │   │  │   └── 游戏状态 TOON（完整版）                              │
│   │   │  ├── buildSplitInjects(prompt, includeShortTermMemory=false)│
│   │   │  │                                                          │
│   │   │  └── generateOnce({                                         │
│   │   │        user_input: 用户操作 + 第1步正文,                      │
│   │   │        usageType: 'instruction_generation' | 'main',        │
│   │   │        should_stream: splitStep2Streaming,                  │
│   │   │        onStreamChunk: undefined                             │
│   │   │      })                                                      │
│   │   │        → parseAIResponse(raw) → parsedStep2                  │
│   │   │                                                             │
│   │   │  合并响应                                                    │
│   │   │  gmResponse = {                                             │
│   │   │    text: step1Text,                                         │
│   │   │    mid_term_memory: parsedStep2.mid_term_memory,            │
│   │   │    tavern_commands: parsedStep2.tavern_commands,            │
│   │   │    action_options: parsedStep2.action_options               │
│   │   │  }                                                          │
│   │   └─────────────────────────────────────────────────────────────┘
│   │
│   └── processGmResponse(gmResponse)
│       ├── 写入 系统.历史.叙事[]
│       ├── 写入 社交.记忆.短期记忆[]
│       ├── 执行 tavern_commands
│       └── 返回 { saveData, stateChanges }
│
├── gameStateStore.loadFromSaveData()
└── UI 更新（Area B 显示最终文本）
```

### 9.2 开局流程

```
用户点击开始游戏
│
├── generateInitialMessage()
│   │
│   ├── isSplitEnabled = localStorage.dad_game_settings.splitResponseGeneration
│   │
│   │   第1步：开局正文
│   │   ├── buildInitialSplitSystemPrompt(1)
│   │   │   ├── splitInitStep1 提示词
│   │   │   ├── worldStandards
│   │   │   └── 角色设定（userPrompt）
│   │   └── generateOnce({ step: 1, usageType: 'main', ... })
│   │       → extractNarrativeText(raw) → step1Text
│   │
│   │   第2步：开局指令
│   │   ├── buildInitialSplitSystemPrompt(2)
│   │   │   ├── splitInitStep2 提示词（含 CoT 自检清单）
│   │   │   ├── 酒馆身体数据要求（Tavern 模式）
│   │   │   ├── businessRules
│   │   │   ├── dataDefinitions
│   │   │   └── worldStandards
│   │   └── generateOnce({ step: 2, usageType: 'instruction_generation' | 'main', ... })
│   │       → parseAIResponse(raw) → parsedStep2
│   │
│   └── 合并 → processGmResponse()
│
└── gameStateStore.loadFromSaveData()
```

---

## 10. 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/components/dashboard/APIManagementPanel.vue` | 分步生成开关 UI，设置持久化到 localStorage |
| `src/utils/AIBidirectionalSystem.ts` | 分步生成核心逻辑：提示词组装、两步串行执行、响应合并、重试 |
| `src/services/prompts/defaultPrompts.ts` | 提示词模板：splitGenerationStep1/Step2, splitInitStep1/Step2 |
| `src/services/aiService.ts` | API 路由：根据 usageType 选择不同的 API 配置 |
| `src/stores/apiManagementStore.ts` | API 管理：instruction_generation API 配置、splitStep2Streaming |
