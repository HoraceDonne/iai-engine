// 文件位置: src/core/solver.ts
import type { Node, Rect, GeometryMap, SolverViewport, RenderPipelineConfig, LeafNode } from './types';

export interface GridLine {
  id: string;
  position: number;
  crossStart: number;
  crossEnd: number;
}

export interface OrthogonalGrid {
  vLines: GridLine[];
  hLines: GridLine[];
}

export function computeGeometryMap(
  root: Node,
  viewport: SolverViewport,
  config: RenderPipelineConfig,
  getProps: (node: LeafNode) => any // 🌟 唯一修改：接收引擎属性
): GeometryMap {
  const map: GeometryMap = new Map();
  if (!root) return map;

  const rootRect: Rect = {
    x: 0,
    y: 0,
    width: Math.max(0, viewport.width),
    height: Math.max(0, viewport.height),
  };

  function layout(node: Node, rect: Rect) {
    map.set(node.id, {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });

    if (node.type === 'leaf') return;

    const [child1, child2] = node.children;

    if (node.direction === 'horizontal') {
      const min1 = getTreeMinSize(child1, 'horizontal', getProps);
      const min2 = getTreeMinSize(child2, 'horizontal', getProps);

      const fixed1 = child1.type === 'leaf' && child1.isFixed ? child1.fixedSize : null;
      const fixed2 = child2.type === 'leaf' && child2.isFixed ? child2.fixedSize : null;

      let w1: number, w2: number;
      if (fixed1 !== null && fixed1 !== undefined) {
        w1 = fixed1;
        w2 = rect.width - w1;
      } else if (fixed2 !== null && fixed2 !== undefined) {
        w2 = fixed2;
        w1 = rect.width - w2;
      } else {
        w1 = Math.round(rect.width * node.ratio);
        w2 = rect.width - w1;
      }

      // minSize 钳制：保证不会小于最小值
      if (w1 < min1) { w1 = min1; w2 = rect.width - w1; }
      if (w2 < min2) { w2 = min2; w1 = rect.width - w2; }

      // lockedAtMin 锁定机制
      if (child1.type === 'leaf' && child1.lockedAtMin && w1 > min1) {
        w1 = min1;
        w2 = rect.width - w1;
      }
      if (child2.type === 'leaf' && child2.lockedAtMin && w2 > min2) {
        w2 = min2;
        w1 = rect.width - w2;
      }

      // 极端情况：窗口太小，无法同时满足两个 minSize，等比缩放
      if (rect.width < min1 + min2 && min1 + min2 > 0) {
        const scale = rect.width / (min1 + min2);
        w1 = Math.round(min1 * scale);
        w2 = rect.width - w1;
      }

      layout(child1, { x: rect.x, y: rect.y, width: w1, height: rect.height });
      layout(child2, { x: rect.x + w1, y: rect.y, width: w2, height: rect.height });

    } else {
      const min1 = getTreeMinSize(child1, 'vertical', getProps);
      const min2 = getTreeMinSize(child2, 'vertical', getProps);

      const fixed1 = child1.type === 'leaf' && child1.isFixed ? child1.fixedSize : null;
      const fixed2 = child2.type === 'leaf' && child2.isFixed ? child2.fixedSize : null;

      let h1: number, h2: number;
      if (fixed1 !== null && fixed1 !== undefined) {
        h1 = fixed1;
        h2 = rect.height - h1;
      } else if (fixed2 !== null && fixed2 !== undefined) {
        h2 = fixed2;
        h1 = rect.height - h2;
      } else {
        h1 = Math.round(rect.height * node.ratio);
        h2 = rect.height - h1;
      }

      // minSize 钳制
      if (h1 < min1) { h1 = min1; h2 = rect.height - h1; }
      if (h2 < min2) { h2 = min2; h1 = rect.height - h2; }

      // 极端情况等比缩放
      if (rect.height < min1 + min2 && min1 + min2 > 0) {
        const scale = rect.height / (min1 + min2);
        h1 = Math.round(min1 * scale);
        h2 = rect.height - h1;
      }

      layout(child1, { x: rect.x, y: rect.y, width: rect.width, height: h1 });
      layout(child2, { x: rect.x, y: rect.y + h1, width: rect.width, height: h2 });
    }
  }

  layout(root, rootRect);
  return map;
}

// 计算子树的最小尺寸
function getTreeMinSize(node: Node, direction: 'horizontal' | 'vertical', getProps: (node: LeafNode) => any): number {
  if (node.type === 'leaf') {
    if (node.isFixed && node.fixedSize !== undefined) return node.fixedSize;
    // 🌟 唯一修改：获取真实属性
    return getProps(node as LeafNode).minSize ?? 40;
  }
  if (node.direction === direction) {
    return getTreeMinSize(node.children[0], direction, getProps) + getTreeMinSize(node.children[1], direction, getProps);
  } else {
    return Math.max(getTreeMinSize(node.children[0], direction, getProps), getTreeMinSize(node.children[1], direction, getProps));
  }
}

export function extractOrthogonalGrid(
  root: Node,
  geometryMap: GeometryMap
): OrthogonalGrid {
  const vLines: GridLine[] = [];
  const hLines: GridLine[] = [];

  function traverse(node: Node) {
    if (node.type === 'leaf') return;
    const rect = geometryMap.get(node.id);
    if (!rect) return;
    const child1 = node.children[0];
    const child1Rect = geometryMap.get(child1.id);
    if (!child1Rect) return;

    if (node.direction === 'horizontal') {
      vLines.push({ id: node.id, position: child1Rect.x + child1Rect.width, crossStart: rect.y, crossEnd: rect.y + rect.height });
    } else {
      hLines.push({ id: node.id, position: child1Rect.y + child1Rect.height, crossStart: rect.x, crossEnd: rect.x + rect.width });
    }
    traverse(node.children[0]);
    traverse(node.children[1]);
  }

  traverse(root);
  return { vLines, hLines };
}