<template>
  <div class="event-flow-node" :class="['level-' + (data.impactLevel || '中等')]" @click="$emit('click', data)">
    <!-- 事件类型标签 -->
    <div class="node-type-badge" :style="{ backgroundColor: typeColor }">
      {{ data.eventType }}
    </div>

    <!-- 事件名称 -->
    <div class="node-title">{{ data.eventName }}</div>

    <!-- 时间 -->
    <div class="node-time">{{ data.time }}</div>

    <!-- 影响等级和来源 -->
    <div class="node-meta">
      <span v-if="data.impactLevel" class="impact-badge" :style="{ backgroundColor: levelColor }">
        {{ data.impactLevel }}
      </span>
      <span class="source-badge">{{ data.eventSource }}</span>
    </div>

    <!-- 描述预览 -->
    <div class="node-desc">{{ truncateDesc }}</div>

    <!-- 删除按钮 -->
    <button class="delete-btn" @click.stop="$emit('delete', data.eventId)" title="删除事件">🗑️</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventFlowNodeData } from '@/types/eventFlow';
import { getEventTypeColor, getImpactLevelColor } from '@/types/eventFlow';

const props = defineProps<{
  data: EventFlowNodeData;
}>();

defineEmits<{
  (e: 'click', data: EventFlowNodeData): void;
  (e: 'delete', eventId: string): void;
}>();

const typeColor = computed(() => getEventTypeColor(props.data.eventType));
const levelColor = computed(() => getImpactLevelColor(props.data.impactLevel || '中等'));

const truncateDesc = computed(() => {
  const desc = props.data.description || '';
  if (desc.length <= 60) return desc;
  return desc.slice(0, 60) + '...';
});
</script>

<style scoped>
.event-flow-node {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 10px 12px;
  min-width: 200px;
  max-width: 280px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.event-flow-node:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.event-flow-node.level-轻微 {
  border-left: 4px solid #22c55e;
}

.event-flow-node.level-中等 {
  border-left: 4px solid #eab308;
}

.event-flow-node.level-重大 {
  border-left: 4px solid #f97316;
}

.event-flow-node.level-灾难 {
  border-left: 4px solid #ef4444;
}

.node-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  color: white;
  font-weight: 600;
  margin-bottom: 6px;
}

.node-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  margin-bottom: 4px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.impact-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  color: white;
  font-weight: 500;
}

.source-badge {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  background: var(--color-surface-light);
  padding: 1px 6px;
  border-radius: 3px;
}

.node-desc {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  max-height: 2.8em;
  overflow: hidden;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.event-flow-node:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
</style>
