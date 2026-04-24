<template>
  <div class="prompt-panel">
    <div class="panel-header compact">
      <div class="panel-title-compact">
        <span class="title-text">📝 提示词管理</span>
      </div>
      <div class="panel-search">
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索提示词（名称 / 键名 / 描述）"
          :disabled="Object.keys(promptsByCategory).length === 0"
        />
        <button class="clear-btn" @click="searchQuery = ''" :disabled="!searchQuery" title="清空搜索">×</button>
      </div>
      <div class="panel-actions">
        <button class="action-btn-compact" @click="expandAllCategories" title="全部展开">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <button class="action-btn-compact" @click="collapseAllCategories" title="全部折叠">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
        <button class="action-btn-compact" @click="exportPrompts" title="导出全部">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="action-btn-compact" @click="importPrompts" title="导入" :disabled="isOnlineMode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>
        <button class="action-btn-compact primary" @click="saveAll" title="保存全部" :disabled="isOnlineMode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
        <button class="action-btn-compact danger" @click="resetAllPrompts" title="重置全部" :disabled="isOnlineMode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- 联机模式警告 -->
    <div v-if="isOnlineMode" class="online-mode-warning">
      <span class="warning-icon">🔒</span>
      <span class="warning-text">联机模式下提示词仅供查看，无法编辑</span>
    </div>

    <!-- 分步生成模式提示 -->
    <div v-if="isSplitGeneration" class="split-mode-notice">
      <span class="notice-icon">⚡</span>
      <span class="notice-text">分步生成模式已开启，非分步条目已标记。可手动启用。</span>
    </div>

    <div class="prompt-list">
      <div v-if="Object.keys(displayPromptsByCategory).length === 0" class="empty-search">
        未找到匹配的提示词
      </div>
      <!-- 分类显示 -->
      <div v-for="(categoryData, categoryKey) in displayPromptsByCategory" :key="categoryKey" class="category-section">
        <!-- 分类头部 -->
        <div class="category-header" @click="toggleCategory(String(categoryKey))">
          <div class="category-title">
            <span class="category-icon">{{ categoryData.info.icon }}</span>
            <span class="category-name">{{ categoryData.info.name }}</span>
            <span class="category-count">{{ categoryData.prompts.length }} 个提示词</span>
          </div>
          <div class="category-actions">
            <span class="category-desc">{{ categoryData.info.description }}</span>
            <!-- 添加自定义提示词按钮（仅 coreRequest 分类显示） -->
            <button
              v-if="categoryKey === 'coreRequest'"
              class="add-prompt-btn"
              title="添加自定义提示词"
              :disabled="isOnlineMode"
              @click.stop="openAddDialog"
            >+</button>
            <svg
              class="expand-icon"
              :class="{ expanded: expandedCategories[categoryKey] }"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <!-- 分类内容（可拖动排序的列表容器） -->
        <div v-if="expandedCategories[categoryKey]" class="category-content" :ref="(el) => { if (el) setSortableRef(String(categoryKey), el as HTMLElement) }">
          <div v-for="prompt in categoryData.prompts" :key="prompt.key" class="prompt-item" :data-id="prompt.key">
            <div class="prompt-header" @click="togglePrompt(prompt.key)">
              <div class="prompt-title-area">
                <!-- 启用/禁用开关 -->
                <div class="toggle-switch" @click.stop="toggleEnabled(prompt.key, !prompt.enabled)">
                  <span class="toggle-slider" :class="{ active: prompt.enabled }"></span>
                </div>
                <!-- 分步模式标记 -->
                <span v-if="isSplitGeneration && isSplitPrompt(prompt)" class="split-mode-badge split-active" title="分步生成模式专用条目">分步</span>
                <span v-if="isSplitGeneration && !isSplitPrompt(prompt)" class="split-mode-badge" title="非分步生成模式条目">非分步</span>
                <!-- 序号已包含在name中，不再单独显示 -->
                <span class="prompt-title" :class="{ disabled: !prompt.enabled }">{{ prompt.name }}</span>
              </div>
              <div class="prompt-meta">
                <!-- 角色选择下拉 -->
                <select
                  class="role-select"
                  :value="prompt.role"
                  :disabled="isOnlineMode"
                  @change="updateRole(prompt.key, ($event.target as HTMLSelectElement).value as 'system' | 'user' | 'assistant')"
                  @click.stop
                  :title="`注入角色: ${roleLabel(prompt.role)}`"
                >
                  <option value="system">系统</option>
                  <option value="user">用户</option>
                  <option value="assistant">助手</option>
                </select>
                <div v-if="prompt.weight !== undefined" class="weight-editor" @click.stop>
                  <label class="weight-label">W</label>
                  <input
                    type="number"
                    class="weight-input"
                    :class="getWeightClass(prompt.weight)"
                    :value="prompt.weight"
                    min="1"
                    max="10"
                    :disabled="isOnlineMode"
                    @change="updateWeight(prompt.key, Number(($event.target as HTMLInputElement).value))"
                    @click.stop
                  />
                </div>
                <span v-if="prompt.description" class="prompt-desc" :title="prompt.description">
                  {{ truncateText(prompt.description, 30) }}
                </span>
                <span class="prompt-key" :title="prompt.key" @click.stop>
                  {{ prompt.key }}
                </span>
                <span v-if="prompt.isCustom" class="prompt-status custom-badge">自创</span>
                <span class="prompt-status" :class="{ modified: prompt.modified }">
                  {{ prompt.modified ? '已修改' : '默认' }}
                </span>
                <!-- 拖动手柄 -->
                <span class="drag-handle" title="拖动排序" @click.stop>⠿</span>
              </div>
            </div>
            <div v-if="expandedPrompts[prompt.key]" class="prompt-content">
              <div v-if="prompt.description" class="prompt-description-full">
                {{ prompt.description }}
              </div>
              <textarea
                v-model="prompt.content"
                @input="markModified(prompt.key)"
                rows="20"
                class="prompt-textarea"
                :disabled="isOnlineMode"
                :class="{ 'readonly-mode': isOnlineMode }"
              ></textarea>
              <div class="prompt-actions">
                <button v-if="prompt.isCustom" class="btn-small btn-danger" @click="deletePrompt(prompt.key)" :disabled="isOnlineMode">删除</button>
                <button v-if="!prompt.isCustom" class="btn-small" @click="resetPrompt(prompt.key)" :disabled="isOnlineMode">重置为默认</button>
                <button class="btn-small" @click="exportSingle(prompt.key)">导出此项</button>
                <button class="btn-small btn-primary" @click="saveSingle(prompt.key)" :disabled="isOnlineMode">保存修改</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建自创提示词对话框 -->
    <div v-if="showAddDialog" class="modal-overlay" @click.self="showAddDialog = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">添加自定义提示词</span>
          <button class="modal-close" @click="showAddDialog = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>名称 <span class="required">*</span></label>
            <input v-model="newPrompt.name" class="form-input" placeholder="如：6. 额外世界观" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="newPrompt.description" class="form-input" placeholder="简要描述此提示词的用途" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>角色</label>
              <select v-model="newPrompt.role" class="form-select">
                <option value="system">系统</option>
                <option value="user">用户</option>
                <option value="assistant">助手</option>
              </select>
            </div>
            <div class="form-group">
              <label>权重</label>
              <input v-model.number="newPrompt.weight" type="number" class="form-input" min="1" max="10" />
            </div>
          </div>
          <div class="form-group">
            <label>内容 <span class="required">*</span></label>
            <textarea v-model="newPrompt.content" class="form-textarea" rows="12" placeholder="输入提示词内容..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-small" @click="showAddDialog = false">取消</button>
          <button class="btn-small btn-primary" @click="createCustomPrompt" :disabled="!newPrompt.name.trim() || !newPrompt.content.trim()">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { promptStorage, type PromptItem, type PromptsByCategory } from '@/services/promptStorage';
import { toast } from '@/utils/toast';
import { createDadBundle, unwrapDadBundle } from '@/utils/dadBundle';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStateStore } from '@/stores/gameStateStore';
import Sortable from 'sortablejs';

const characterStore = useCharacterStore();
const gameStateStore = useGameStateStore();

// 检测是否为联机模式
const isOnlineMode = computed(() => {
  return characterStore.activeCharacterProfile?.模式 === '联机';
});

// 检测是否开启分步生成
const isSplitGeneration = computed(() => {
  const settings = localStorage.getItem('dad_game_settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      return parsed.splitResponseGeneration === true;
    } catch {
      return false;
    }
  }
  return false;
});

// 检测是否开启事件系统
const isEventSystemEnabled = computed(() => {
  return gameStateStore.eventSystem?.配置?.启用随机事件 !== false;
});

const promptsByCategory = ref<PromptsByCategory>({});
const expandedPrompts = ref<Record<string, boolean>>({});
const expandedCategories = ref<Record<string, boolean>>({});
const searchQuery = ref('');

// 新建自创提示词对话框状态
const showAddDialog = ref(false);
const newPrompt = ref({
  name: '',
  description: '',
  content: '',
  role: 'system' as 'system' | 'user' | 'assistant',
  weight: 5,
});

// Sortable 实例管理
const sortableInstances = new Map<string, Sortable>();

const displayPromptsByCategory = computed<PromptsByCategory>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return promptsByCategory.value;

  const filtered: PromptsByCategory = {};
  for (const [categoryKey, categoryData] of Object.entries(promptsByCategory.value)) {
    const prompts = categoryData.prompts.filter((prompt) => {
      const haystack = [prompt.key, prompt.name, prompt.description ?? ''].join('\n').toLowerCase();
      return haystack.includes(query);
    });
    if (prompts.length > 0) {
      filtered[categoryKey] = { info: categoryData.info, prompts };
    }
  }
  return filtered;
});

onMounted(async () => {
  // 初次加载时同步分步生成状态（确保 UI 开关与实际状态一致）
  await promptStorage.syncEnabledToSplitMode(isSplitGeneration.value);
  await loadPrompts();
});

// 监听分步生成模式变化，同步 enabled 状态后重新加载
watch(isSplitGeneration, async (newVal, oldVal) => {
  if (newVal !== oldVal) {
    // 同步分步/非分步提示词的 enabled 状态
    await promptStorage.syncEnabledToSplitMode(newVal);
    await loadPrompts();
    if (newVal) {
      toast.info('分步生成模式已开启，非分步条目已自动禁用');
    } else {
      toast.info('分步生成模式已关闭，分步条目已自动禁用');
    }
  }
});

async function loadPrompts() {
  promptsByCategory.value = await promptStorage.loadByCategory({
    isOnlineMode: isOnlineMode.value,
    isSplitGeneration: isSplitGeneration.value,
    isEventSystemEnabled: isEventSystemEnabled.value
  });
  // 默认展开第一个分类
  const firstCategory = Object.keys(promptsByCategory.value)[0];
  if (firstCategory) {
    expandedCategories.value[firstCategory] = true;
  }
  // 分步模式下初始化排序
  await nextTick();
  initAllSortable();
}

watch(searchQuery, () => {
  const query = searchQuery.value.trim();
  if (!query) return;
  for (const key of Object.keys(displayPromptsByCategory.value)) {
    expandedCategories.value[key] = true;
  }
});

/**
 * 判断提示词是否属于分步生成模式
 */
function isSplitPrompt(prompt: PromptItem): boolean {
  if (prompt.condition === 'splitGeneration') return true;
  // coreRequest 类别中的提示词在分步模式下仍然需要（作为上下文）
  // 但分步模式的专用提示词有 condition 标记
  return false;
}

/**
 * 角色标签的中文映射
 */
function roleLabel(role: 'system' | 'user' | 'assistant'): string {
  const map: Record<string, string> = { system: '系统', user: '用户', assistant: '助手' };
  return map[role] || role;
}

function toggleCategory(categoryKey: string) {
  expandedCategories.value[categoryKey] = !expandedCategories.value[categoryKey];
  // 展开时初始化排序
  if (expandedCategories.value[categoryKey]) {
    nextTick(() => initSortable(categoryKey));
  }
}

function togglePrompt(key: string) {
  expandedPrompts.value[key] = !expandedPrompts.value[key];
}

async function toggleEnabled(key: string, enabled: boolean) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.enabled = enabled;
      break;
    }
  }
  await promptStorage.setEnabled(key, enabled);
  toast.info(enabled ? '已启用' : '已禁用');
}

/**
 * 更新提示词角色
 */
async function updateRole(key: string, role: 'system' | 'user' | 'assistant') {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.role = role;
      await promptStorage.setRole(key, role);
      toast.success(`角色已设为 ${roleLabel(role)}`);
      break;
    }
  }
}

function expandAllCategories() {
  for (const key in displayPromptsByCategory.value) {
    expandedCategories.value[key] = true;
  }
  nextTick(() => initAllSortable());
}

function collapseAllCategories() {
  for (const key in displayPromptsByCategory.value) {
    expandedCategories.value[key] = false;
  }
  expandedPrompts.value = {};
  destroyAllSortable();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function getWeightClass(weight: number): string {
  if (weight >= 9) return 'weight-high';
  if (weight >= 6) return 'weight-medium';
  return 'weight-low';
}

function markModified(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.modified = prompt.content !== prompt.default;
      break;
    }
  }
}

async function updateWeight(key: string, weight: number) {
  const clampedWeight = Math.min(10, Math.max(1, Math.round(weight)));
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.weight = clampedWeight;
      await promptStorage.save(key, prompt.content, prompt.enabled, clampedWeight);
      toast.success(`权重已更新为 ${clampedWeight}`);
      break;
    }
  }
}

async function saveSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      await promptStorage.save(key, prompt.content, prompt.enabled, prompt.weight, prompt.role);
      toast.success(`已保存: ${prompt.name}`);
      break;
    }
  }
}

async function saveAll() {
  let savedCount = 0;
  for (const categoryKey in promptsByCategory.value) {
    for (const prompt of promptsByCategory.value[categoryKey].prompts) {
      if (prompt.modified) {
        await promptStorage.save(prompt.key, prompt.content, prompt.enabled, prompt.weight, prompt.role);
        savedCount++;
      }
    }
  }
  if (savedCount > 0) {
    toast.success(`已保存 ${savedCount} 项修改`);
  } else {
    toast.info('没有需要保存的修改');
  }
}

async function resetPrompt(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      prompt.content = prompt.default;
      prompt.modified = false;
      await promptStorage.reset(key);
      toast.info(`已重置: ${prompt.name}`);
      break;
    }
  }
}

async function resetAllPrompts() {
  if (!confirm('确定要重置全部提示词为默认值吗？此操作不可撤销。')) {
    return;
  }
  await promptStorage.resetAll();
  await loadPrompts();
  toast.success('已重置全部提示词为默认值');
}

function exportSingle(key: string) {
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      const data = createDadBundle('prompts', { [key]: prompt.content });
      downloadJSON(data, `prompt_${key}.json`);
      break;
    }
  }
}

async function exportPrompts() {
  const rawData = await promptStorage.exportAll();
  const data = createDadBundle('prompts', rawData);
  downloadJSON(data, 'prompts_all.json');
  toast.success('已导出全部提示词');
}

function importPrompts() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rawData = JSON.parse(text);
      const unwrapped = unwrapDadBundle(rawData);
      const promptsData = unwrapped.type === 'prompts' ? unwrapped.payload : rawData;
      const count = await promptStorage.importPrompts(promptsData);
      await loadPrompts();
      toast.success(`成功导入 ${count} 个提示词`);
    } catch (error) {
      toast.error('导入失败，请检查文件格式');
    }
  };
  input.click();
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== 自创提示词管理 ====================

function openAddDialog() {
  newPrompt.value = {
    name: '',
    description: '',
    content: '',
    role: 'system',
    weight: 5,
  };
  showAddDialog.value = true;
}

async function createCustomPrompt() {
  const { name, content, description, role, weight } = newPrompt.value;
  if (!name.trim() || !content.trim()) {
    toast.error('名称和内容不能为空');
    return;
  }

  try {
    const key = await promptStorage.createCustom({
      name: name.trim(),
      content: content.trim(),
      category: 'coreRequest',
      description: description.trim() || undefined,
      weight,
      role,
    });
    showAddDialog.value = false;
    await loadPrompts();
    toast.success(`已创建自定义提示词: ${name}`);
    // 自动展开新创建的条目
    expandedPrompts.value[key] = true;
  } catch (e) {
    toast.error('创建失败');
  }
}

async function deletePrompt(key: string) {
  // 查找提示词名称
  let promptName = key;
  for (const categoryKey in promptsByCategory.value) {
    const prompt = promptsByCategory.value[categoryKey].prompts.find(p => p.key === key);
    if (prompt) {
      promptName = prompt.name;
      break;
    }
  }

  if (!confirm(`确定要删除自定义提示词「${promptName}」吗？此操作不可撤销。`)) {
    return;
  }

  const deleted = await promptStorage.deletePrompt(key);
  if (deleted) {
    await loadPrompts();
    toast.success(`已删除: ${promptName}`);
  } else {
    toast.error('默认提示词不可删除');
  }
}

// ==================== 拖动排序 ====================

function setSortableRef(categoryKey: string, el: HTMLElement) {
  initSortable(categoryKey, el);
}

function initSortable(categoryKey: string, el?: HTMLElement) {
  // 销毁已有实例
  const existing = sortableInstances.get(categoryKey);
  if (existing) {
    existing.destroy();
    sortableInstances.delete(categoryKey);
  }

  // 获取 DOM 元素
  const container = el || document.querySelector(`[data-category="${categoryKey}"] .category-content`);
  if (!container) return;

  const instance = Sortable.create(container as HTMLElement, {
    handle: '.drag-handle',
    animation: 200,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd: async (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;

      // 获取当前分类的提示词列表
      const categoryData = promptsByCategory.value[categoryKey];
      if (!categoryData) return;

      // 移动数组元素
      const moved = categoryData.prompts.splice(oldIndex, 1)[0];
      categoryData.prompts.splice(newIndex, 0, moved);

      // 生成新的 customOrder 映射
      const orders: Record<string, number> = {};
      categoryData.prompts.forEach((p, idx) => {
        orders[p.key] = idx + 1;
        p.customOrder = idx + 1;
      });

      // 销毁当前 Sortable 实例（DOM 即将被 Vue 重新渲染）
      instance.destroy();
      sortableInstances.delete(categoryKey);

      // 持久化
      await promptStorage.setCustomOrders(orders);
      toast.info(`已调整 ${moved.name} 的顺序`);

      // Vue 重新渲染后重新初始化 Sortable
      await nextTick();
      initSortable(categoryKey, evt.from as HTMLElement);
    },
  });

  sortableInstances.set(categoryKey, instance);
}

function initAllSortable() {
  // Sortable 实例通过模板中的 setSortableRef 回调自动初始化
  // 这里仅处理尚未初始化的已展开分类
  for (const categoryKey of Object.keys(promptsByCategory.value)) {
    if (expandedCategories.value[categoryKey] && !sortableInstances.has(categoryKey)) {
      nextTick(() => {
        const el = document.querySelector(`.category-content[data-category="${categoryKey}"]`) as HTMLElement;
        if (el) initSortable(categoryKey, el);
      });
    }
  }
}

function destroyAllSortable() {
  for (const [, instance] of sortableInstances) {
    instance.destroy();
  }
  sortableInstances.clear();
}
</script>

<style scoped>
.prompt-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
}

/* 联机模式警告样式 */
.online-mode-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(251, 191, 36, 0.15);
  border-bottom: 1px solid rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.online-mode-warning .warning-icon {
  font-size: 1rem;
}

.online-mode-warning .warning-text {
  font-size: 0.85rem;
  font-weight: 500;
}

/* 分步模式提示样式 */
.split-mode-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(139, 92, 246, 0.15);
  border-bottom: 1px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
}

.split-mode-notice .notice-icon {
  font-size: 1rem;
}

.split-mode-notice .notice-text {
  font-size: 0.85rem;
  font-weight: 500;
}

/* 分步模式标记 */
.split-mode-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  white-space: nowrap;
}

.split-mode-badge.split-active {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* 角色选择下拉 */
.role-select {
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.75rem;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.role-select:hover {
  border-color: var(--color-primary);
}

.role-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.15);
}

.role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 拖动手柄 */
.drag-handle {
  cursor: grab;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.25rem;
  opacity: 0.4;
  transition: opacity 0.2s;
  user-select: none;
}

.drag-handle:hover {
  opacity: 1;
  color: var(--color-primary);
}

.drag-handle:active {
  cursor: grabbing;
}

/* Sortable 拖动样式 */
.sortable-ghost {
  opacity: 0.4;
  background: rgba(var(--color-primary-rgb), 0.1);
}

.sortable-chosen {
  background: rgba(var(--color-primary-rgb), 0.05);
}

.sortable-drag {
  opacity: 0.9;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 只读模式样式 */
.prompt-textarea.readonly-mode {
  opacity: 0.7;
  cursor: not-allowed;
  background: var(--color-surface-disabled, rgba(100, 100, 100, 0.1));
}

.btn-small:disabled,
.action-btn-compact:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.panel-header.compact {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}


.panel-title-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.title-text {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-search {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1 1 260px;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-light);
  color: var(--color-text);
  outline: none;
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.15);
}

.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn:not(:disabled):hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.empty-search {
  padding: 0.9rem 1rem;
  border-radius: 12px;
  border: 1px dashed var(--color-border);
  background: var(--color-surface-light);
  color: var(--color-text-secondary);
  margin: 0.9rem 0;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-compact:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-btn-compact.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn-compact.primary:hover {
  background: var(--color-primary-hover);
}

.action-btn-compact.danger {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.action-btn-compact.danger:hover {
  background: #b91c1c;
}

.prompt-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* 分类样式 */
.category-section {
  margin-bottom: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--color-surface);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.category-header:hover {
  background: var(--color-surface-hover);
}

.category-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.category-icon {
  font-size: 1.25rem;
}

.category-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
}

.category-count {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-background);
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.expand-icon {
  transition: transform 0.3s ease;
  color: var(--color-text-secondary);
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.category-content {
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}

/* 提示词项目样式 */
.prompt-item {
  border-bottom: 1px solid var(--color-border);
}

.prompt-item:last-child {
  border-bottom: none;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1.25rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.prompt-header:hover {
  background: var(--color-surface-hover);
}

.prompt-title-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* 开关样式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-border);
  transition: 0.3s;
  border-radius: 20px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-slider.active {
  background-color: var(--color-primary);
}

.toggle-slider.active:before {
  transform: translateX(16px);
}

.toggle-switch:hover .toggle-slider {
  box-shadow: 0 0 4px rgba(var(--color-primary-rgb), 0.4);
}

.prompt-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: var(--color-primary);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
}

.prompt-title {
  font-weight: 500;
  color: var(--color-text);
  transition: opacity 0.2s;
}

.prompt-title.disabled {
  opacity: 0.5;
  text-decoration: line-through;
}

.prompt-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.prompt-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.72rem;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  user-select: text;
}

.prompt-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.prompt-status.modified {
  background: rgba(var(--color-warning-rgb), 0.2);
  color: var(--color-warning);
}

/* 权重编辑器 */
.weight-editor {
  display: flex;
  align-items: center;
  gap: 2px;
}

.weight-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.weight-input {
  width: 36px;
  height: 22px;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-align: center;
  background: transparent;
  transition: all 0.2s;
  -moz-appearance: textfield;
}

.weight-input::-webkit-outer-spin-button,
.weight-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.weight-input:hover {
  border-color: var(--color-border);
  background: var(--color-surface);
}

.weight-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.weight-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.weight-input.weight-high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.weight-input.weight-medium {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.weight-input.weight-low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.prompt-content {
  padding: 1rem 1.25rem;
  background: var(--color-background);
  border-top: 1px solid var(--color-border);
}

.prompt-description-full {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.prompt-textarea {
  width: 100%;
  min-height: 400px;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  resize: vertical;
}

.prompt-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2);
}

.prompt-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  justify-content: flex-end;
}

.btn-small {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.btn-small:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
}

.btn-small.btn-primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.btn-small.btn-primary:hover {
  background: var(--color-primary-hover);
}

/* 响应式适配 */
@media (max-width: 768px) {
  .panel-header.compact {
    flex-wrap: wrap;
  }

  .panel-search {
    flex: 1 1 100%;
    min-width: 0;
  }

  .category-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .category-actions {
    width: 100%;
    justify-content: space-between;
  }

  .prompt-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .prompt-meta {
    width: 100%;
    justify-content: space-between;
  }

  .prompt-desc {
    max-width: 150px;
  }

  .prompt-textarea {
    min-height: 300px;
  }
}

/* 添加提示词按钮 */
.add-prompt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  padding: 0;
}

.add-prompt-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.add-prompt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 自创提示词标记 */
.custom-badge {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* 删除按钮 */
.btn-danger {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.3);
}

.btn-danger:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

/* 模态对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 0.35rem;
}

.required {
  color: #ef4444;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.15);
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.15);
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}
</style>
