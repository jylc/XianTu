import type { Node, Edge } from '@vue-flow/core';
import type { GameEvent } from './game';

/** 事件流程图节点数据 */
export interface EventFlowNodeData {
  eventId: string;
  eventName: string;
  eventType: string;
  impactLevel?: string;
  eventSource: string;
  time: string;
  description: string;
  relatedPersons?: string[];
  relatedFactions?: string[];
  scope?: string;
}

/** 事件流程图边数据 */
export interface EventFlowEdgeData {
  edgeType: 'timeline' | 'shared_person' | 'shared_faction';
  sharedEntity?: string;
}

/** 事件流程图边数据 */
export interface EventFlowEdgeData {
  edgeType: 'timeline' | 'shared_person' | 'shared_faction';
  sharedEntity?: string;
}

/** Vue Flow 节点类型 */
export type EventFlowNode = Node<EventFlowNodeData>;

/** Vue Flow 边类型 */
export type EventFlowEdge = Edge<EventFlowEdgeData>;

/** 转换结果 */
export interface EventFlowTransformResult {
  nodes: EventFlowNode[];
  edges: EventFlowEdge[];
}

/** 事件类型到颜色的映射 */
export const EVENT_TYPE_COLORS: Record<string, string> = {
  '宗门大战': '#ef4444',
  '世界变革': '#8b5cf6',
  '异宝降世': '#f59e0b',
  '秘境现世': '#10b981',
  '人物风波': '#ec4899',
  '势力变动': '#3b82f6',
  '天灾人祸': '#6b7280',
  '特殊NPC': '#06b6d4',
};

/** 影响等级到颜色的映射 */
export const IMPACT_LEVEL_COLORS: Record<string, string> = {
  '轻微': '#22c55e',
  '中等': '#eab308',
  '重大': '#f97316',
  '灾难': '#ef4444',
};

/** 获取事件类型颜色 */
export function getEventTypeColor(type: string): string {
  return EVENT_TYPE_COLORS[type] || '#6b7280';
}

/** 获取影响等级颜色 */
export function getImpactLevelColor(level: string): string {
  return IMPACT_LEVEL_COLORS[level] || '#6b7280';
}
