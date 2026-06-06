// src/core/IaiEngine.ts
import { EventBus } from './EventBus';
import type {
  Node, LeafNode, SplitNode, PanelEntity, FreePanel, StashEntry,
  GeometryMap, RenderPipelineConfig, RenderItem,
  Direction, Rect, PanelTypeConfig
} from './types';
import { computeGeometryMap, extractOrthogonalGrid, type OrthogonalGrid } from './solver';
import type { IaiPlugin } from '../plugins/types';

// ── 事件定义 ──
export interface EngineEvents {
  'tree:update': { tree: Node | null };
  'free:update': { count: number };
  'stash:update': { count: number };
  'focus:change': { id: string | null };
  'hover:change': { id: string | null };
  'drag:start': { sourceId: string; sourceType: 'grid' | 'float' };
  'drag:move': { sourceId: string; sourceType: 'grid' | 'float'; x: number; y: number; deltaX: number; deltaY: number; hoveredPanelId: string | null };
  'drag:end': { sourceId: string; sourceType: 'grid' | 'float'; endX: number; endY: number; deltaX: number; deltaY: number; hoveredPanelId: string | null };
  'drag:shield': { active: boolean; cursor?: string };
  'panel:destroyed': { id: string };
}

// ── 1. 引擎绝对底线默认值 (兜底) ──
const ENGINE_BASE_CONFIG: Omit<PanelTypeConfig, 'panelType'> = {
  title: '未命名面板',
  defaultWidth: 300, 
  defaultHeight: 300, 
  minSize: 100,
  shared: true,       // 默认启用共享容器
  syncAll: false,     // 默认不自动同步所有 ref
  resizable: true, 
  draggable: true, 
  floatable: true, 
  closable: true
};

// ── 引擎主体 ──
export class IaiEngine {
  // ── 注册表 ──
  private compRegistry = new Map<string, any>();
  // 存储在 reg() 时显式传入的面板配置
  private typeRegistry = new Map<string, Partial<PanelTypeConfig>>(); 
  private plugins = new Map<string, IaiPlugin>();

  // ── 动态数据池 ──
  private root: Node | null = null;
  private freePanels = new Map<string, FreePanel>();
  private stashPool = new Map<string, StashEntry>();

  // ── 共享容器与私有容器（数据管理） ──
  private sharedContainers = new Map<string, Record<string, any>>();
  private privateContainers = new Map<string, Record<string, any>>();

  // ── 事件与焦点 ──
  public readonly events = new EventBus<EngineEvents>();
  private focusedId: string | null = null;
  private hoveredId: string | null = null;

  // ── 配置与视口 ──
  private config: RenderPipelineConfig = { gear: 'balanced', snapToPixel: true };
  private _viewport: { width: number; height: number } = { width: 0, height: 0 };

  // ── 内部工具 ──
  private uid(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // ═══════════════════════════════════════
  // 窗口获取
  // ═══════════════════════════════════════
  public setViewport(w: number, h: number) {
    this._viewport = { width: w, height: h };
  }

  public getViewport() {
    return this._viewport;
  }

  // ═══════════════════════════════════════
  // 阶段一：资产注册 & 插件 (Registration)
  // ═══════════════════════════════════════
  
  /**
   * 注册面板组件与配置
   * @param type 面板类型 (如 'test')
   * @param comp 框架组件 (如 markRaw(TestPanel))
   * @param config 显式配置，按需传入，没传的将使用引擎底线默认值
   */
  public reg(type: string, comp: any, config?: Partial<Omit<PanelTypeConfig, 'panelType'>>): this {
    this.compRegistry.set(type, comp);
    this.typeRegistry.set(type, { 
      ...(config || {}), 
      panelType: type 
    });

    // 如果配置了 shared: true，则创建一个普通空对象作为共享容器（不在这里做响应式）
    const fullConfig = this.getPanelProps({ panelType: type } as PanelEntity);
    if (fullConfig.shared) {
      if (!this.sharedContainers.has(type)) {
        this.sharedContainers.set(type, {});
      }
    }

    return this;
  }

  public getComp(type: string) {
    return this.compRegistry.get(type);
  }

  public use(plugin: IaiPlugin): this {
    plugin.install(this);
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  public unuse(name: string): boolean {
    const p = this.plugins.get(name);
    if (!p) return false;
    p.uninstall?.(this);
    this.plugins.delete(name);
    return true;
  }

  public getPlugins(): IaiPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** 获取所有已注册的面板类型列表 */
  public getRegisteredTypes(): string[] {
    return Array.from(this.compRegistry.keys());
  }

  // ═══════════════════════════════════════
  // 阶段二：动态合成 (The Data Merger) 🌟 核心枢纽
  // ═══════════════════════════════════════
  
  /**
   * 核心 API：获取面板在当前时刻的“最终有效属性”。
   * 任何需要读取面板 minSize、title 等属性的地方，都必须通过此方法获取。
   */
  public getPanelProps(entity: PanelEntity): PanelTypeConfig & PanelEntity {
    // 1. 抓取在 reg() 注册时存入的特定配置
    const registeredConfig = this.typeRegistry.get(entity.panelType) || {};
    
    // 2. 清洗 entity 中的 undefined，防止覆盖掉配置中的有效值
    const cleanEntity = Object.fromEntries(
      Object.entries(entity).filter(([_, v]) => v !== undefined)
    );

    // 3. 完美的三重合并：内置底线 < 注册配置 < 实例动态值
    return {
      ...ENGINE_BASE_CONFIG,
      panelType: entity.panelType, 
      ...registeredConfig,
      ...cleanEntity
    } as PanelTypeConfig & PanelEntity;
  }

  // ═══════════════════════════════════════
  // 阶段三：实例工厂 (The Factory)
  // ═══════════════════════════════════════

  /** 创建本体：极简轻量，仅生成实体壳子，绝不冗余存储默认值 */
  public createMaster(panelType: string, overrides?: Partial<PanelEntity>): PanelEntity {
    const id = this.uid('master');
    const { id: _id, instanceId, isMaster, panelType: _pt, type, ...rest } = overrides || {} as any;
    return {
      id,
      panelType,
      isMaster: true,
      instanceId: id,
      ...rest
    };
  }

  /** 创建影子：追溯本体 ID */
  public createShadow(master: PanelEntity, panelType?: string, overrides?: Partial<PanelEntity>): PanelEntity {
    const id = this.uid('shadow');
    const { id: _id, instanceId, isMaster, panelType: _pt, type, ...rest } = overrides || {} as any;
    return {
      id,
      panelType: panelType ?? master.panelType,
      isMaster: false,
      instanceId: master.instanceId || master.id,
      ...rest
    };
  }

    /** 获取面板类型的全局共享容器（普通对象，由 Vue 层负责响应式包装） */
  public getSharedContainer(panelType: string): Record<string, any> {
    if (!this.sharedContainers.has(panelType)) {
      this.sharedContainers.set(panelType, {});
    }
    return this.sharedContainers.get(panelType)!;
  }

  /** 获取面板实例的私有容器（普通对象，由 Vue 层负责响应式包装） */
  public getPrivateContainer(panelId: string): Record<string, any> {
    if (!this.privateContainers.has(panelId)) {
      this.privateContainers.set(panelId, {});
    }
    return this.privateContainers.get(panelId)!;
  }

  // ═══════════════════════════════════════
  // 焦点系统
  // ═══════════════════════════════════════
  public focus(id: string | null): boolean {
    if (this.focusedId === id) return false;
    if (id && !this.getAny(id)) return false;
    this.focusedId = id;
    this.events.emit('focus:change', { id });
    return true;
  }

  public getFocus(): string | null { return this.focusedId; }
  public focusNext(): void {}
  public focusPrev(): void {}

  public setHover(id: string | null): void {
    if (this.hoveredId === id) return;
    if (id) {
      const entity = this.getAny(id);
      if (entity?.ignoreHover) return;
    }
    this.hoveredId = id;
    this.events.emit('hover:change', { id });
  }

  public getHover(): string | null { return this.hoveredId; }

  // ═══════════════════════════════════════
  // 结构化池（二叉树）
  // ═══════════════════════════════════════
  public mount(tree: Node, trusted = false): void {
    // 递归规范化传入的树，补全缺失的实体标识 (ID 等)
    const normalize = (node: any): Node => {
      if (node.type === 'leaf') {
        return {
          id: node.id || this.uid('leaf'),
          panelType: node.panelType,
          isMaster: node.isMaster ?? true,
          instanceId: node.instanceId || node.id || this.uid('leaf'),
          ...node 
        } as LeafNode;
      }
      return {
        ...node,
        id: node.id || this.uid('split'),
        children: [normalize(node.children[0]), normalize(node.children[1])]
      } as SplitNode;
    };

    this.root = trusted ? tree : normalize(JSON.parse(JSON.stringify(tree)));
    this.emitTree();
  }

  public getRoot(): Node | null { return this.root; }

  public getNode(id: string): LeafNode | null {
    if (!this.root) return null;
    let found: LeafNode | null = null;
    const dfs = (node: Node) => {
      if (found) return;
      if (node.type === 'leaf' && node.id === id) {
        found = node;
        return;
      }
      if (node.type === 'split') {
        dfs(node.children[0]);
        dfs(node.children[1]);
      }
    };
    dfs(this.root);
    if (found) return { ...(found as LeafNode) };
    return null;
  }

  public getAllNodes(): LeafNode[] {
    const leaves: LeafNode[] = [];
    if (!this.root) return leaves;
    const dfs = (node: Node) => {
      if (node.type === 'leaf') { leaves.push(node); return; }
      dfs(node.children[0]); dfs(node.children[1]);
    };
    dfs(this.root);
    return leaves.map(n => ({ ...n }));
  }

  public splitNode(targetId: string, dir: Direction, ratio: number, panel: PanelEntity, insertAsSecond = true): boolean {
    if (!this.root) return false;
    let done = false;
    const traverse = (node: Node): Node => {
      if (node.type === 'leaf' && node.id === targetId) {
        done = true;
        return {
          type: 'split',
          id: this.uid('split'),
          direction: dir,
          ratio,
          children: insertAsSecond 
            ? [node, { ...panel, type: 'leaf' } as LeafNode]
            : [{ ...panel, type: 'leaf' } as LeafNode, node]
        };
      }
      if (node.type === 'split') {
        const c1 = traverse(node.children[0]);
        const c2 = traverse(node.children[1]);
        if (c1 !== node.children[0] || c2 !== node.children[1]) {
          return { ...node, children: [c1, c2] };
        }
      }
      return node;
    };
    this.root = traverse(this.root);
    if (done) this.emitTree();
    return done;
  }

  public deleteNode(id: string): boolean {
    if (!this.root) return false;
    if (this.focusedId === id) this.focus(null);
    if (this.root.id === id) { this.root = null; this.emitTree(); return true; }
    
    let deleted = false;
    const traverse = (node: Node): Node | null => {
      if (node.type === 'leaf') {
        if (node.id === id) { deleted = true; return null; }
        return node;
      }
      const c1 = traverse(node.children[0]);
      const c2 = traverse(node.children[1]);
      if (c1 !== null && c2 !== null) {
        if (c1 === node.children[0] && c2 === node.children[1]) return node;
        return { ...node, children: [c1, c2] };
      }
      return c1 || c2; // 兄弟提升
    };
    this.root = traverse(this.root);
    if (deleted) this.emitTree();
    return deleted;
  }

  public replace(id: string, panel: PanelEntity): boolean {
    if (!this.root) {
      const fp = this.freePanels.get(id);
      if (fp) { fp.panel = panel; this.events.emit('free:update', { count: this.freePanels.size }); return true; }
      return false;
    }

    let replaced = false;
    const traverse = (node: Node): Node => {
      if (node.type === 'split' && node.id === id) {
        replaced = true;
        return {
          ...node,
          ...panel,
          type: 'split',
          children: (node as SplitNode).children,
        } as SplitNode;
      }
      if (node.type === 'leaf' && node.id === id) {
        replaced = true;
        return { ...panel, type: 'leaf' } as LeafNode;
      }
      if (node.type === 'split') {
        const c1 = traverse(node.children[0]);
        const c2 = traverse(node.children[1]);
        if (c1 !== node.children[0] || c2 !== node.children[1]) return { ...node, children: [c1, c2] };
      }
      return node;
    };

    this.root = traverse(this.root);
    if (replaced) { this.emitTree(); return true; }

    const fp = this.freePanels.get(id);
    if (fp) { fp.panel = panel; this.events.emit('free:update', { count: this.freePanels.size }); return true; }
    return false;
  }

  // ═══════════════════════════════════════
  // 自由池
  // ═══════════════════════════════════════
  public addFree(panel: PanelEntity, rect: Rect, z = 100): void {
    this.freePanels.set(panel.id, { id: panel.id, panel, ...rect, zIndex: z });
    this.events.emit('free:update', { count: this.freePanels.size });
  }

  public updateFree(id: string, u: Partial<Omit<FreePanel, 'id' | 'panel'>>): boolean {
    const fp = this.freePanels.get(id);
    if (!fp) return false;
    Object.assign(fp, u);
    this.events.emit('free:update', { count: this.freePanels.size });
    return true;
  }

  public removeFree(id: string): boolean {
    const ok = this.freePanels.delete(id);
    if (ok) this.events.emit('free:update', { count: this.freePanels.size });
    return ok;
  }

  public getFree(id: string): FreePanel | undefined { return this.freePanels.get(id); }
  public getAllFree(): FreePanel[] { return Array.from(this.freePanels.values()); }

  // ═══════════════════════════════════════
  // 暂存池（常驻池）
  // ═══════════════════════════════════════
  public stash(id: string): boolean {
    const entity = this.getAny(id);
    if (!entity) return false;
    this.stashPool.set(entity.instanceId || entity.id, { ...entity });
    this.deleteAny(id);
    this.events.emit('stash:update', { count: this.stashPool.size });
    return true;
  }

  public getStash(id: string): PanelEntity | null {
    return this.stashPool.get(id) ?? null;
  }

  public getAllStash(): PanelEntity[] {
    return Array.from(this.stashPool.values());
  }

  public removeStash(id: string): boolean {
    const ok = this.stashPool.delete(id);
    if (ok) this.events.emit('stash:update', { count: this.stashPool.size });
    return ok;
  }

  public addToStash(panel: PanelEntity): void {
    const key = panel.instanceId || panel.id;
    this.stashPool.set(key, panel);
    this.events.emit('stash:update', { count: this.stashPool.size });
  }

  // ═══════════════════════════════════════
  // 实例/引用查询
  // ═══════════════════════════════════════
  public getRefs(instanceId: string): PanelEntity[] {
    const refs: PanelEntity[] = [];
    for (const leaf of this.getAllNodes()) {
      if ((leaf.instanceId || leaf.id) === instanceId) refs.push(leaf);
    }
    for (const fp of this.freePanels.values()) {
      if ((fp.panel.instanceId || fp.panel.id) === instanceId) refs.push(fp.panel);
    }
    return refs;
  }

  public getAny(id: string): PanelEntity | null {
    return this.getNode(id) ?? this.freePanels.get(id)?.panel ?? this.stashPool.get(id) ?? null;
  }

  public deleteAny(id: string): boolean {
    if (this.deleteNode(id)) return true;
    if (this.removeFree(id)) return true;
    if (this.removeStash(id)) return true;
    return false;
  }

  // ═══════════════════════════════════════
  // 渲染与几何
  // ═══════════════════════════════════════
  public getRenderItems(vw: number, vh: number): RenderItem[] {
    const items: RenderItem[] = [];
    if (this.root) {
      const geoMap = computeGeometryMap(
        this.root, 
        { width: vw, height: vh }, 
        this.config,
        (node: LeafNode) => this.getPanelProps(node)
      );
      for (const leaf of this.getAllNodes()) {
        const rect = geoMap.get(leaf.id) ?? { x: 0, y: 0, width: 0, height: 0 };
        items.push({ id: leaf.id, node: leaf, rect, zIndex: 1, isFloating: false });
      }
    }
    for (const fp of this.freePanels.values()) {
      items.push({
        id: fp.id,
        node: fp.panel,
        rect: { x: fp.x, y: fp.y, width: fp.width, height: fp.height },
        zIndex: fp.zIndex,
        isFloating: true,
        customClass: 'is-floating'
      });
    }
    return items.sort((a, b) => a.zIndex - b.zIndex);
  }

  public getGeoMap(vw: number, vh: number): GeometryMap {
    if (!this.root) return new Map();
    return computeGeometryMap(
      this.root, 
      { width: vw, height: vh }, 
      this.config,
      (node: LeafNode) => this.getPanelProps(node)
    );
  }

  public getGridLines(geoMap: GeometryMap): OrthogonalGrid {
    if (!this.root) return { vLines: [], hLines: [] };
    return extractOrthogonalGrid(this.root, geoMap);
  }

  // ═══════════════════════════════════════
  // 序列化
  // ═══════════════════════════════════════
  public save(): any {
    return {
      root: this.root,
      freePanels: [...this.freePanels.values()],
      stashPool: [...this.stashPool.values()]
    };
  }

  public load(state: any): void {
    this.root = state.root ?? null;
    this.freePanels.clear();
    if (state.freePanels) for (const fp of state.freePanels) this.freePanels.set(fp.id, fp);
    this.stashPool.clear();
    if (state.stashPool) for (const s of state.stashPool) this.stashPool.set(s.instanceId || s.id, s);
    this.events.emit('tree:update', { tree: this.root });
    this.events.emit('free:update', { count: this.freePanels.size });
    this.events.emit('stash:update', { count: this.stashPool.size });
  }

  private emitTree() {
    this.events.emit('tree:update', { tree: this.root });
  }
}