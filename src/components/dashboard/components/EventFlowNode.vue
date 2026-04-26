<template>
  <div class="event-flow-node">
    <div class="event-header">
      <span class="event-type">{{ data.事件类型 }}</span>
      <span class="event-name">{{ data.事件名称 }}</span>
      <span class="event-time">{{ data.formattedTime }}</span>
      <div class="event-actions">
        <button class="icon-btn event-delete-btn" title="删除" @click="handleDelete">🗑️</button>
      </div>
    </div>
    <div class="event-meta">
      <span v-if="data.影响等级" class="meta-tag" :class="'level-' + data.影响等级">{{ data.影响等级 }}</span>
      <span v-if="data.影响范围" class="meta-tag scope">{{ data.影响范围 }}</span>
      <span v-if="data.事件来源" class="meta-tag source">{{ data.事件来源 }}</span>
    </div>
    <div
      v-if="(data.相关人物 && data.相关人物.length) || (data.相关势力 && data.相关势力.length)"
      class="event-relations"
    >
      <span v-if="data.相关人物 && data.相关人物.length" class="relation-group">
        <span class="relation-label">相关人物:</span>
        <span v-for="(person, idx) in data.相关人物" :key="idx" class="relation-item person">{{ person }}</span>
      </span>
      <span v-if="data.相关势力 && data.相关势力.length" class="relation-group">
        <span class="relation-label">相关势力:</span>
        <span v-for="(faction, idx) in data.相关势力" :key="idx" class="relation-item faction">{{ faction }}</span>
      </span>
    </div>
    <div class="event-desc">{{ data.事件描述 }}</div>
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

interface EventNodeData {
  事件ID: string
  事件名称: string
  事件类型: string
  事件描述: string
  影响等级?: string
  影响范围?: string
  相关人物?: string[]
  相关势力?: string[]
  事件来源: string
  formattedTime: string
  onDelete: () => void
}

const props = defineProps<{
  data: EventNodeData
}>()

const handleDelete = () => {
  props.data.onDelete()
}
</script>

<style>
.event-flow-node {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  width: 360px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.event-flow-node .event-header {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 10px;
  align-items: baseline;
  margin-bottom: 8px;
}

.event-flow-node .event-actions {
  display: flex;
  justify-content: flex-end;
}

.event-flow-node .event-delete-btn {
  color: var(--color-text-secondary);
}

.event-flow-node .event-delete-btn:hover {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.08);
}

.event-flow-node .event-type {
  font-size: 0.78rem;
  color: var(--color-primary);
  border: 1px solid rgba(var(--color-primary-rgb), 0.35);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.event-flow-node .event-name {
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-flow-node .event-time {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.event-flow-node .event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.event-flow-node .meta-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-surface-light);
  color: var(--color-text-secondary);
}

.event-flow-node .meta-tag.level-轻微 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.event-flow-node .meta-tag.level-中等 {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.event-flow-node .meta-tag.level-重大 {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.event-flow-node .meta-tag.level-灾难 {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.event-flow-node .meta-tag.scope {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.event-flow-node .meta-tag.source {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.event-flow-node .event-relations {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.82rem;
}

.event-flow-node .relation-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.event-flow-node .relation-label {
  color: var(--color-text-secondary);
}

.event-flow-node .relation-item {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
}

.event-flow-node .relation-item.person {
  background: rgba(236, 72, 153, 0.12);
  color: #ec4899;
}

.event-flow-node .relation-item.faction {
  background: rgba(20, 184, 166, 0.12);
  color: #14b8a6;
}

.event-flow-node .event-desc {
  color: var(--color-text);
  line-height: 1.55;
  white-space: pre-wrap;
}

.event-flow-node .icon-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.event-flow-node .icon-btn:hover {
  background: var(--color-surface-hover);
  transform: scale(1.1);
}

.event-flow-node .vue-flow__handle {
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border: 2px solid var(--color-surface);
}
</style>
