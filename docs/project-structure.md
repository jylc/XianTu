# 仙途 (XianTu) 项目结构

> 生成日期: 2026-04-19

## 项目概述

仙途是一个 AI 驱动的沉浸式修仙文字冒险游戏，基于 Vue 3 + TypeScript 构建。支持独立 Web 模式和 SillyTavern 集成模式，支持多种 AI 提供商。

## 根目录

```
XianTu/
├── src/                    # 源代码
├── dist/                   # 构建输出
├── docs/                   # 项目文档
├── webpack/                # Webpack 配置
├── node_modules/           # 依赖
├── package.json            # 项目配置与依赖
├── tsconfig.json           # TypeScript 配置
├── webpack.config.js       # Webpack 构建配置
├── index.html              # HTML 入口
├── .eslintrc.js            # ESLint 配置
├── CLAUDE.md               # Claude Code 指引
├── CHANGELOG.md            # 更新日志
└── README.md               # 项目说明
```

---

## `src/` 源代码结构

```
src/
├── main.ts                 # 应用入口，初始化 Vue + Pinia + Router + i18n
├── App.vue                 # 根组件，管理全局游戏状态与路由
├── env.d.ts                # TypeScript 环境声明
├── style.css               # 全局样式
├── components/             # Vue 组件 (88 个文件)
├── composables/            # Vue 组合式函数
├── data/                   # 静态游戏数据
├── i18n/                   # 国际化
├── router/                 # 路由配置
├── services/               # 业务逻辑服务
├── stores/                 # Pinia 状态管理
├── styles/                 # CSS 样式模块
├── systems/                # 游戏系统逻辑
├── types/                  # TypeScript 类型定义
├── utils/                  # 工具函数
└── views/                  # 页面级视图组件
```

---

## `src/stores/` — Pinia 状态管理

| 文件 | 功能 |
|------|------|
| `characterStore.ts` | 角色数据管理：创建、加载、保存、IndexedDB 持久化、Tavern 集成、云端同步、NPC 寿命/技能计算 |
| `gameStateStore.ts` | 游戏运行时状态：玩家属性、背包、位置、NPC 档案与关系、世界信息、门派、记忆、事件、状态效果 |
| `characterCreationStore.ts` | 角色创建流程：7 步创建向导（世界→天赋等级→出身→灵根→天赋→属性分配→预览）|
| `uiStore.ts` | UI 状态：Toast 通知、加载状态、AI 处理状态、流式输出、思维链显示、弹窗管理、状态变更日志 |
| `apiManagementStore.ts` | API 配置管理：多 AI 提供商（OpenAI/Claude/Gemini/DeepSeek/智谱）、功能分配、生成模式 |
| `actionQueueStore.ts` | 行动队列系统：玩家行动排队（修炼/装备/使用/交易）、冲突解决、行动持久化 |

---

## `src/types/` — TypeScript 类型定义

| 文件 | 功能 |
|------|------|
| `index.ts` | 核心类型：World, TalentTier, Origin, SpiritRoot, Talent, CharacterGameState, Inventory, Item, TavernHelper |
| `game.d.ts` | 游戏数据结构：SystemConfig, StateChangeLog, MemoryEntry, PlayerAttributes, NpcProfile, GameTime, SaveData (V3), SectSystemV2, StatusEffect |
| `saveSchemaV3.ts` | V3 存档数据 Schema |
| `eventFlow.ts` | 事件流程类型，叙事系统 |
| `gameMap.ts` | 地图与坐标系统类型 |
| `location.ts` | 地点数据结构 |
| `memory.ts` | 记忆系统类型 |
| `textRules.ts` | 文本格式化规则类型 |
| `worldMap.ts` | 世界地图配置类型 |
| `AIGameMaster.d.ts` | AI GM（游戏主持人）接口定义 |
| `vue-global.d.ts` | Vue 全局类型扩展 |

---

## `src/services/` — 业务逻辑服务

### 核心服务

| 文件 | 功能 |
|------|------|
| `aiService.ts` | 统一 AI 服务：支持 Tavern 模式和自定义 API 调用 |
| `httpClient.ts` | HTTP 请求封装 |
| `request.ts` | API 请求导出 |
| `backendConfig.ts` | 后端 URL 配置 |
| `embeddingService.ts` | 文本向量化服务，语义搜索 |
| `vectorMemoryService.ts` | 基于向量的记忆检索 |
| `characterInitialization.ts` | 角色初始化逻辑 |
| `offlineInitialization.ts` | 离线模式初始化 |
| `onlineTravel.ts` | 在线旅行功能 |
| `onlineLogQueue.ts` | 在线旅行日志队列 |
| `presence.ts` | 用户在线状态 |
| `workshop.ts` | 社区工坊服务 |
| `defaultPrompts.ts` | 默认提示词定义 |
| `promptConfig.ts` | 提示词配置 |
| `promptStorage.ts` | 提示词持久化 |
| `turnstile.ts` | Cloudflare Turnstile 安全验证 |

### `services/api/` — 后端 API 接口

| 文件 | 功能 |
|------|------|
| `auth.ts` | 身份验证（Token 验证） |
| `characters.ts` | 角色 CRUD 操作 |
| `cloudData.ts` | 云端数据（世界、天赋、出身、灵根） |
| `onlineTravel.ts` | 在线旅行 API |
| `presence.ts` | 在线状态 API |
| `workshop.ts` | 工坊/社区内容 API |
| `index.ts` | API 统一导出 |

### `services/initialization/` — 初始化服务

| 文件 | 功能 |
|------|------|
| `characterInitialization.ts` | 角色初始化详细逻辑 |
| `offlineInitialization.ts` | 离线初始化详细逻辑 |

### `services/online/` — 在线功能

| 文件 | 功能 |
|------|------|
| `travelNoteQueue.ts` | 旅行笔记队列 |

### `services/prompts/` — 提示词服务

| 文件 | 功能 |
|------|------|
| `defaultPrompts.ts` | 默认提示词 |
| `promptConfig.ts` | 提示词配置 |
| `promptStorage.ts` | 提示词存储 |

### `services/security/` — 安全服务

| 文件 | 功能 |
|------|------|
| `turnstile.ts` | Cloudflare Turnstile 安全验证 |

---

## `src/utils/` — 工具函数

### 数据管理

| 文件 | 功能 |
|------|------|
| `indexedDBManager.ts` | IndexedDB 封装，存档存储 |
| `saveMigration.ts` | 存档版本迁移 |
| `saveValidationV3.ts` | V3 存档验证 |
| `dataValidation.ts` | 通用数据验证 |
| `dataRepair.ts` | AI 辅助数据修复 |
| `cloudDataSync.ts` | 云端数据同步 |
| `snapshotManager.ts` | 游戏状态快照管理 |

### 游戏机制

| 文件 | 功能 |
|------|------|
| `attributeCalculation.ts` | 属性计算逻辑 |
| `cultivationSpeedCalculator.ts` | 修炼速度计算 |
| `lifespanCalculator.ts` | 角色寿命计算 |
| `masteredSkillsCalculator.ts` | 掌握技能计算 |
| `realmUtils.ts` | 境界/修炼等级工具 |
| `diceRoller.ts` | 随机骰子投掷 |
| `equipmentBonusApplier.ts` | 装备加成计算 |
| `statusEffectManager.ts` | 状态效果管理 |
| `currencySystem.ts` | 货币系统 |
| `craftingSystem.ts` | 炼丹/锻造系统 |

### 游戏系统

| 文件 | 功能 |
|------|------|
| `sectSystemFactory.ts` | 门派系统工厂 |
| `sectLeadershipUtils.ts` | 门派职位判断 |
| `sectWarSimulation.ts` | 门派战争模拟 |
| `sectMigration.ts` | 门派数据迁移 |
| `sixSiManager.ts` | 六司系统管理 |

### AI 集成

| 文件 | 功能 |
|------|------|
| `AIBidirectionalSystem.ts` | AI 双向通信核心系统 |
| `chatBus.ts` | 聊天事件总线 |
| `panelBus.ts` | 面板事件总线 |
| `tavern.ts` | SillyTavern 环境检测与集成 |
| `tavernCore.ts` | Tavern 核心功能 |
| `memoryUtils.ts` | 记忆系统工具（短/中/长期记忆） |
| `memoryFormatConfig.ts` | 记忆格式化配置 |
| `commandValidator.ts` | AI 指令验证 |
| `commandValueValidator.ts` | 指令值验证 |
| `enhancedActionQueue.ts` | 增强行动队列 |
| `nsfw.ts` | NSFW 内容处理 |

### 文本处理

| 文件 | 功能 |
|------|------|
| `textSanitizer.ts` | 文本清理与展示处理 |
| `jsonExtract.ts` | 从 AI 回复中提取 JSON |
| `stateChangeFormatter.ts` | 状态变更格式化 |
| `regex.ts` | 正则表达式工具 |
| `eventFlowTransformer.ts` | 事件流转换 |

### 地图与坐标

| 文件 | 功能 |
|------|------|
| `gameMapManager.ts` | 游戏地图管理 |
| `coordinateConverter.ts` | 坐标转换工具 |

### UI 工具

| 文件 | 功能 |
|------|------|
| `toast.ts` | Toast 通知 |
| `fullscreen.ts` | 全屏 API |
| `presetManager.ts` | 预设管理 |
| `dadBundle.ts` | DAD 打包工具 |

### 调试工具

| 文件 | 功能 |
|------|------|
| `debug.ts` | 调试日志 |
| `debugLogStorage.ts` | 调试日志持久化存储 |
| `consolePatch.ts` | Console 补丁（彩色日志） |

### 其他

| 文件 | 功能 |
|------|------|
| `time.ts` | 时间工具 |
| `machineCode.ts` | 机器码生成 |
| `videoCache.ts` | 视频缓存 |

---

## `src/utils/worldGeneration/` — 世界生成

| 文件 | 功能 |
|------|------|
| `enhancedWorldGenerator.ts` | 增强世界生成器 |
| `enhancedWorldPrompts.ts` | 世界生成提示词 |
| `locationPlacementGenerator.ts` | 地点布局生成 |
| `regionMapGenerator.ts` | 区域地图生成 |
| `sectDataCalculator.ts` | 门派数据计算 |
| `sectDataValidator.ts` | 门派数据验证 |

---

## `src/utils/prompts/` — 提示词系统

### `prompts/promptAssembler.ts`
主提示词组装器，将系统提示词与游戏状态组装发送给 AI。

### `prompts/cot/cotCore.ts`
Chain of Thought（思维链）推理提示词。

### `prompts/definitions/` — 规则定义

| 文件 | 功能 |
|------|------|
| `coreRules.ts` | 核心游戏规则 |
| `businessRules.ts` | 业务逻辑规则 |
| `dataDefinitions.ts` | 存档数据结构定义 |
| `playerPersonality.ts` | 玩家性格特征 |
| `textFormats.ts` | 文本格式化规则 |
| `worldStandards.ts` | 世界观标准 |
| `actionOptions.ts` | 行动选项 |
| `eventSystemRules.ts` | 事件系统规则 |
| `npcRelationRules.ts` | NPC 关系规则 |

### `prompts/tasks/` — 功能提示词

| 文件 | 功能 |
|------|------|
| `characterInitializationPrompts.ts` | 角色初始化提示词 |
| `craftingPrompts.ts` | 炼丹/锻造提示词 |
| `dataRepairPrompts.ts` | 数据修复提示词 |
| `gameElementPrompts.ts` | 游戏元素生成提示词 |

### `generators/eventGenerators.ts`
随机事件生成器。

---

## `src/components/` — Vue 组件

### `components/character-creation/` — 角色创建（13 个组件）

| 文件 | 功能 |
|------|------|
| `Step1_WorldSelection.vue` | 世界选择 |
| `Step2_TalentTierSelection.vue` | 天赋等级选择 |
| `Step3_OriginSelection.vue` | 出身选择 |
| `Step4_SpiritRootSelection.vue` | 灵根选择 |
| `Step5_TalentSelection.vue` | 天赋选择 |
| `Step6_AttributeAllocation.vue` | 属性分配 |
| `Step7_Preview.vue` | 角色预览 |
| `CharacterManagement.vue` | 角色管理（列表/切换） |
| `CustomCreationModal.vue` | 自定义创建弹窗 |
| `LegacySaveMigrationModal.vue` | 旧版存档迁移 |
| `RedemptionCodeModal.vue` | 兑换码 |
| `AIPromptModal.vue` | AI 提示词编辑 |

### `components/common/` — 通用组件（17 个组件）

| 文件 | 功能 |
|------|------|
| `FormattedText.vue` | 富文本渲染 |
| `DetailModal.vue` | 通用详情弹窗 |
| `ProgressBar.vue` | 进度条 |
| `HexagonChart.vue` | 六边形雷达图 |
| `ActionMenu.vue` | 行动菜单 |
| `NumberInputModal.vue` | 数字输入弹窗 |
| `QuantitySelectModal.vue` | 数量选择弹窗 |
| `DeepCultivationModal.vue` | 深度修炼弹窗 |
| `StateChangeViewer.vue` | 状态变更查看器 |
| `DataValidationErrorDialog.vue` | 数据验证错误弹窗 |
| `PresetExportModal.vue` | 预设导出 |
| `PresetImportModal.vue` | 预设导入 |
| `PresetLoadModal.vue` | 预设加载 |
| `PresetSaveModal.vue` | 预设保存 |
| `CloudDataSync.vue` | 云端同步状态 |
| `DataClearButtons.vue` | 数据清理按钮 |
| `LoadingPreSeting.vue` | 加载预设 |
| `GlobalLoadingOverlay.vue` | 全局加载遮罩 |
| `ErrorBoundary.vue` | 错误边界 |
| `ToastContainer.vue` | Toast 通知容器 |
| `VideoBackground.vue` | 视频背景 |
| `StorePreSeting.vue` | 存储预设 |
| `RetryConfirmDialog.vue` | 重试确认弹窗 |
| `TextReplaceRulesModal.vue` | 文本替换规则 |

### `components/dashboard/` — 游戏主界面面板

| 文件 | 功能 |
|------|------|
| `MainGamePanel.vue` | **主游戏面板**：AI 对话、玩家输入、游戏推进 |
| `TopBar.vue` | 顶栏：角色信息、游戏时间 |
| `LeftSidebar.vue` | 左侧导航栏 |
| `RightSidebar.vue` | 右侧导航栏 |
| `CharacterDetailsPanel.vue` | **角色详情**：属性、状态、装备 |
| `SkillsPanel.vue` | **技能面板**：功法、秘术、技能熟练度 |
| `InventoryPanel.vue` | **背包面板**：物品管理、装备、货币 |
| `MemoryCenterPanel.vue` | **记忆中心**：短/中/长期记忆管理 |
| `RelationshipNetworkPanel.vue` | **关系网络**：NPC 关系图谱（力导向图） |
| `GameMapPanel.vue` | **游戏地图**：世界地图导航 |
| `RegionMapPanel.vue` | **区域地图**：区域详细视图 |
| `WorldMapRoute.vue` | 世界地图路由组件 |
| `EventPanel.vue` | **事件面板**：游戏事件系统 |
| `CraftingPanel.vue` | **炼制面板**：炼丹、锻造、炼器 |
| `SectPanel.vue` | **门派面板**：门派信息总览 |
| `SectSystemPanel.vue` | **门派系统**：门派管理操作 |
| `ThousandDaoPanel.vue` | **三千大道**：大道领悟系统 |
| `GameVariablePanel.vue` | **游戏变量**：底层游戏数据编辑器 |
| `PromptManagementPanel.vue` | **提示词管理**：自定义 AI 提示词 |
| `APIManagementPanel.vue` | **API 管理**：AI 接口配置 |
| `SavePanel.vue` | **存档面板**：存档/读档/自动保存 |
| `SettingsPanel.vue` | **设置面板**：游戏设置 |
| `OnlineTravelPanel.vue` | **在线旅行**：多人在线旅行功能 |
| `OnlineTravelMapPanel.vue` | **在线地图**：多人在线地图 |
| `UnmappedLocationsPanel.vue` | **未映射地点**：管理未配置的地点 |

### `components/dashboard/components/` — 面板子组件

**角色相关：**
| 文件 | 功能 |
|------|------|
| `BodyStatsPanel.vue` | 体质/属性面板 |
| `StatusDetailCard.vue` | 状态详情卡片 |

**游戏变量编辑：**
| 文件 | 功能 |
|------|------|
| `GameVariableCharacterSection.vue` | 角色数据区 |
| `GameVariableDataDisplay.vue` | 数据展示 |
| `GameVariableDataHeader.vue` | 数据头部 |
| `GameVariableDataSelector.vue` | 数据选择器 |
| `GameVariableDataStatus.vue` | 数据状态 |
| `GameVariableEditModal.vue` | 数据编辑弹窗 |
| `GameVariableFormatGuideModal.vue` | 格式指南弹窗 |
| `GameVariableMemorySection.vue` | 记忆数据区 |
| `GameVariableRawDataSection.vue` | 原始数据区 |
| `GameVariableSaveDataSection.vue` | 存档数据区 |
| `GameVariableStatsModal.vue` | 统计弹窗 |
| `GameVariableWorldInfoSection.vue` | 世界信息区 |

**门派系统：**
| 文件 | 功能 |
|------|------|
| `SectMembersContent.vue` | 成员列表 |
| `SectLibraryContent.vue` | 门派藏经阁 |
| `SectContributionContent.vue` | 贡献商店 |
| `SectTasksContent.vue` | 门派任务 |
| `SectManagementContent.vue` | 门派管理 |
| `SectWarContent.vue` | 门派战争 |
| `SectMigrationModal.vue` | 门派数据迁移弹窗 |

**事件与地图：**
| 文件 | 功能 |
|------|------|
| `EventDetailPopover.vue` | 事件详情弹窗 |
| `EventFlowNode.vue` | 事件流节点 |
| `MapIcon.vue` | 地图图标 |

**其他：**
| 文件 | 功能 |
|------|------|
| `CustomOptionsSection.vue` | 自定义选项区域 |
| `SaveMigrationModal.vue` | 存档迁移弹窗 |
| `TreeNode.vue` | 树形节点组件 |

---

## `src/views/` — 页面视图

| 文件 | 功能 |
|------|------|
| `ModeSelection.vue` | 模式选择页（离线/在线/工坊） |
| `CharacterCreation.vue` | 角色创建页（7 步向导） |
| `GameView.vue` | 主游戏页（Dashboard 布局） |
| `LoginView.vue` | 登录页 |
| `WorkshopView.vue` | 工坊/社区页 |
| `AccountCenter.vue` | 账户中心页 |

---

## `src/data/` — 静态游戏数据

| 文件 | 功能 |
|------|------|
| `creationData.ts` | 默认角色创建数据（世界、天赋、出身等） |
| `itemQuality.ts` | 物品品质与等级定义 |
| `realms.ts` | 修炼境界定义 |
| `specialNpcs.ts` | 特殊 NPC 定义 |
| `thousandDaoData.ts` | 三千大道数据 |

---

## `src/systems/` — 游戏系统

| 文件 | 功能 |
|------|------|
| `npcRelationNetwork.ts` | NPC 关系网络：关系评分、敌友判断、事件追踪、关系矩阵 |

---

## `src/composables/` — Vue 组合式函数

| 文件 | 功能 |
|------|------|
| `useCharacterData.ts` | 角色数据组合式函数 |
| `useGameData.ts` | 游戏数据组合式函数 |

---

## `src/i18n/` — 国际化

| 文件 | 功能 |
|------|------|
| `index.ts` | 中文语言包、i18n 配置与翻译 |

---

## `src/router/` — 路由

| 文件 | 功能 |
|------|------|
| `index.ts` | Vue Router 配置：使用 `createMemoryHistory()`，支持 iframe 嵌入 |

主要路由：
- `/` — 模式选择
- `/game` — 主游戏（含子路由面板）
- `/creation` — 角色创建
- `/prompts` — 独立提示词管理

---

## `src/styles/` — CSS 样式模块

| 文件 | 功能 |
|------|------|
| `design-system.css` | 设计系统（颜色、间距、字体） |
| `panel-theme.css` | 面板主题样式 |
| `theme-overrides.css` | 主题自定义覆盖 |
| `step-selection.css` | 角色创建步骤样式 |

---

## `webpack/` — 构建配置

| 文件 | 功能 |
|------|------|
| `TavernLiveReloadPlugin.js` | SillyTavern 开发热重载插件（Socket.IO） |

---

## 技术栈概要

| 分类 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 (MemoryHistory) |
| 构建 | Webpack 5 |
| 样式 | Tailwind CSS + 自定义 CSS |
| 图表 | Chart.js, react-force-graph-2d |
| 渲染 | Pixi.js |
| HTTP | Axios |
| 存储 | IndexedDB (idb), localStorage |
| 工具 | Lodash, @vueuse/core |

## 核心架构特点

1. **双模式运行**：支持独立 Web 模式和 SillyTavern 嵌入模式
2. **多 AI 提供商**：OpenAI、Claude、Gemini、DeepSeek、智谱 AI 等
3. **离线优先**：IndexedDB 本地存储，云端同步可选
4. **模块化提示词**：可自定义的 AI 提示词系统
5. **V3 存档格式**：带验证与迁移的存档系统
6. **流式 AI 输出**：实时显示 AI 生成内容
7. **向量记忆**：基于语义的游戏记忆检索
