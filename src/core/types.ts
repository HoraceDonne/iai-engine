export type Direction = 'horizontal' | 'vertical';

export interface Rect {
  x: number; y: number; width: number; height: number;
}

// ── 面板实体 ──


// ── 1. 静态面板类型配置 (Blueprint/Base Asset) ──
// 这些数据由组件开发者编写，挂载在 Vue 组件上，全局唯一
export interface PanelTypeConfig {
  panelType: string;
  title: string;
  icon?: string;
  
  // 物理与约束基准
  defaultWidth: number;
  defaultHeight: number;
  minSize: number;
  maxSize?: number;
  aspectRatio?: number;

  // 行为权限基准
  resizable: boolean;
  draggable: boolean;
  floatable: boolean;
  closable: boolean;
  shared?: boolean;   // 新增：是否启用共享容器
  syncAll?: boolean;  // 新增：是否默认同步所有顶层 ref

  meta?: Record<string, any>; 
}

// ── 2. 动态面板实体 (Instance) ──
// 这些数据是在引擎运行时生成的，代表屏幕上的一个真实面板块
// ── 2. 动态面板实体 (Instance) ──
export interface PanelEntity {
  id: string;          // 实例唯一标识
  panelType: string;   // 指向其所属的静态配置类型
  isMaster: boolean;   // 状态：本体还是影子
  instanceId?: string; // 影子的溯源 ID
  
  // 物理与权限的实例级覆盖值 (Overrides)
  minSize?: number;
  maxSize?: number;
  isFixed?: boolean;
  fixedSize?: number;
  lockedAtMin?: boolean;
  resizable?: boolean;
  draggable?: boolean;
  floatable?: boolean;
  closable?: boolean;

  // 👇 新增：运行期专属的临时交互状态
  ignoreHover?: boolean;
  ignoreFocus?: boolean;

  // 运行期状态或业务透传数据
  meta?: Record<string, any>;
}

// ── 二叉树节点 ──
export interface LeafNode extends PanelEntity {
  type: 'leaf';
}

export interface SplitNode {
  type: 'split';
  id: string;
  direction: Direction;
  ratio: number;
  children: [Node, Node];
}

export type Node = LeafNode | SplitNode;

// ── 自由池节点 ──
export interface FreePanel {
  id: string;
  panel: PanelEntity;
  x: number; y: number; width: number; height: number;
  zIndex: number;
}

export type StashEntry = PanelEntity;
export type GeometryMap = Map<string, Rect>;

export interface SolverViewport {
  width: number; height: number;
}

export interface RenderPipelineConfig {
  gear: 'eco' | 'balanced' | 'extreme';
  snapToPixel: boolean;
}

export interface RenderItem {
  id: string;
  node: PanelEntity;
  rect: Rect;
  zIndex: number;
  isFloating: boolean;
  customClass?: string;
}