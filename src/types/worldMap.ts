/**
 * @fileoverview World map related type definitions
 */

/**
 * Represents a faction in the world
 */
export interface Faction {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  textColor: string;
  emblem: string;
  description: string;
  strength: number;
  territory: string;
  memberCount?: string;
  specialties?: string[];
}

/**
 * Represents a territory in the world
 */
export interface TerritoryData {
  id: string;
  factionId: string;
  name: string;
  boundary: string; // SVG path
  centerX: number;
  centerY: number;
  color: string;
  borderColor: string;
  textColor: string;
  emblem: string;
}

/**
 * Represents a terrain feature in the world
 */
export interface TerrainFeature {
  id: string;
  name: string;
  path: string; // SVG path
  labelX: number;
  labelY: number;
}

/**
 * Represents the terrain data of the world
 */
export interface TerrainData {
  mountains: TerrainFeature[];
  forests: TerrainFeature[];
  waters: TerrainFeature[];
}

/**
 * Represents a trade route in the world
 */
export interface TradeRoute {
  id: string;
  name: string;
  path: string; // SVG path
  from: string;
  to: string;
}

/**
 * Represents a continent in the world
 */
export interface CultivationContinent {
  id: string;
  name?: string;
  名称?: string;
  description?: string;
  描述?: string;
  continent_bounds?: { x: number; y: number }[];
  大洲边界?: { x: number; y: number }[];
  climate?: string;
  气候?: string;
  terrain_features?: string[];
  地理特征?: string[];
  natural_barriers?: string[];
  天然屏障?: string[];
  特点?: string;
  主要势力?: string[];
}

/**
 * Represents the configuration for the world map generation
 */
export interface WorldMapConfig {
  width: number; // Virtual width of the map
  height: number; // Virtual height of the map
  minLng: number; // Minimum x for geo-to-virtual conversion
  maxLng: number; // Maximum x
  minLat: number; // Minimum y
  maxLat: number; // Maximum y
}

/**
 * 地图视图状态
 * 用于保存和恢复地图的缩放、位置等视图状态
 */
export interface MapViewState {
  /** 视图中心点在世界坐标系中的 X 位置 */
  centerX: number;
  /** 视图中心点在世界坐标系中的 Y 位置 */
  centerY: number;
  /** 当前缩放级别 */
  scale: number;
  /** 视口宽度（像素） */
  screenWidth: number;
  /** 视口高度（像素） */
  screenHeight: number;
  /** 状态保存时间戳 */
  timestamp?: number;
}

/**
 * 地图持久化配置
 * 用于控制地图视图状态的持久化行为
 */
export interface MapPersistenceConfig {
  /** 是否启用视图状态持久化 */
  enabled: boolean;
  /** 存储键名（用于 localStorage） */
  storageKey: string;
  /** 自动保存间隔（毫秒），0 表示仅在特定事件时保存 */
  autoSaveInterval: number;
  /** 是否在页面卸载前保存状态 */
  saveBeforeUnload: boolean;
}
