<template>
  <Teleport to="body">
    <Transition name="popover">
      <div v-if="visible && event" class="event-detail-overlay" @click.self="$emit('close')">
        <div class="event-detail-popover">
          <div class="popover-header">
            <div class="header-left">
              <span class="type-badge" :style="{ backgroundColor: typeColor }">{{ event.eventType }}</span>
              <h3 class="event-name">{{ event.eventName }}</h3>
            </div>
            <button class="close-btn" @click="$emit('close')">✕</button>
          </div>

          <div class="popover-body">
            <!-- 时间 -->
            <div class="detail-row">
              <span class="detail-label">发生时间</span>
              <span class="detail-value">{{ event.time }}</span>
            </div>

            <!-- 元信息 -->
            <div class="detail-row meta-row">
              <span v-if="event.impactLevel" class="meta-tag" :class="'level-' + event.impactLevel">
                {{ event.impactLevel }}
              </span>
              <span v-if="event.scope" class="meta-tag scope">{{ event.scope }}</span>
              <span class="meta-tag source">{{ event.eventSource }}</span>
            </div>

            <!-- 相关人物 -->
            <div v-if="event.relatedPersons && event.relatedPersons.length" class="detail-section">
              <span class="section-label">相关人物</span>
              <div class="tag-list">
                <span v-for="person in event.relatedPersons" :key="person" class="tag person">
                  {{ person }}
                </span>
              </div>
            </div>

            <!-- 相关势力 -->
            <div v-if="event.relatedFactions && event.relatedFactions.length" class="detail-section">
              <span class="section-label">相关势力</span>
              <div class="tag-list">
                <span v-for="faction in event.relatedFactions" :key="faction" class="tag faction">
                  {{ faction }}
                </span>
              </div>
            </div>

            <!-- 描述 -->
            <div class="detail-section">
              <span class="section-label">事件描述</span>
              <div class="description-content">{{ event.description }}</div>
            </div>
          </div>

          <div class="popover-footer">
            <button class="delete-btn" @click="$emit('delete', event.eventId)">
              🗑️ 删除事件
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventFlowNodeData } from '@/types/eventFlow';
import { getEventTypeColor } from '@/types/eventFlow';

const props = defineProps<{
  visible: boolean;
  event: EventFlowNodeData | null;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'delete', eventId: string): void;
}>();

const typeColor = computed(() => getEventTypeColor(props.event?.eventType || ''));
</script>

<style scoped>
.event-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.event-detail-popover {
  background: var(--color-surface);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.popover-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: white;
  font-weight: 600;
  width: fit-content;
}

.event-name {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
}

.close-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  border-radius: 6px;
}

.close-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.popover-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  min-width: 70px;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--color-text);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-tag {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 4px;
}

.meta-tag.level-轻微 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.meta-tag.level-中等 {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.meta-tag.level-重大 {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.meta-tag.level-灾难 {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.meta-tag.scope {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.meta-tag.source {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.detail-section {
  margin-bottom: 16px;
}

.section-label {
  display: block;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.tag.person {
  background: rgba(236, 72, 153, 0.12);
  color: #ec4899;
}

.tag.faction {
  background: rgba(20, 184, 166, 0.12);
  color: #14b8a6;
}

.description-content {
  font-size: 0.9rem;
  color: var(--color-text);
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--color-surface-light);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.popover-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

/* 过渡动画 */
.popover-enter-active,
.popover-leave-active {
  transition: all 0.25s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
}

.popover-enter-from .event-detail-popover,
.popover-leave-to .event-detail-popover {
  transform: scale(0.95) translateY(10px);
}
</style>
