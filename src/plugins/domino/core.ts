// src/plugins/domino/core.ts
import type { Node, Rect, GeometryMap, LeafNode } from '../../core/types';
import type { OrthogonalGrid, GridLine } from '../../core/solver';

export type DragMode = 'domino' | 'simple';

export interface DominoConfig {
  fpsLimit: number;
  deadzone: number;
  clampToViewport: boolean;
  rigidClamp: boolean;
  zIndexBase: number;
}

export interface DragContext {
  splitId: string;
  direction: 'horizontal' | 'vertical';
  initialPositions: Map<string, number>;
  viewportWidth: number;
  viewportHeight: number;
  leafPanels: BoundPanel[];
  config: DominoConfig;
  mode: DragMode;
  edges: { from: string; to: string; weight: number }[];
}

export interface BoundPanel {
  id: string;
  minSize: number;
  leftLineId: string | null;
  rightLineId: string | null;
  topLineId: string | null;
  bottomLineId: string | null;
}

function getLongestPath(sourceId: string, edges: { from: string; to: string; weight: number }[]): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(sourceId, 0);
  const V = edges.length + 2; 
  for (let i = 0; i < V; i++) {
    let updated = false;
    for (const e of edges) {
      if (dist.has(e.from)) {
        const d = dist.get(e.from)! + e.weight;
        if (!dist.has(e.to) || d > dist.get(e.to)!) {
          dist.set(e.to, d);
          updated = true;
        }
      }
    }
    if (!updated) break;
  }
  return dist;
}

export function createDragContext(
  tree: Node,
  splitId: string,
  viewport: { width: number; height: number },
  geometryMap: GeometryMap,
  grid: OrthogonalGrid,
  config: DominoConfig,
  mode: DragMode,
  getProps: (node: LeafNode) => any // 🌟 唯一修改：接收引擎属性
): DragContext | null {
  const initialPositions = new Map<string, number>();
  grid.vLines.forEach(l => initialPositions.set(l.id, l.position));
  grid.hLines.forEach(l => initialPositions.set(l.id, l.position));

  const isVerticalLine = grid.vLines.some(l => l.id === splitId);
  const direction = isVerticalLine ? 'horizontal' : 'vertical';
  const leafPanels: BoundPanel[] = [];

  const getBestLine = (lines: GridLine[], pos: number, crossStart: number, crossEnd: number) => {
    const TOLERANCE = 1;
    const matches = lines.filter(l => Math.abs(l.position - pos) < TOLERANCE && Math.max(l.crossStart, crossStart) < Math.min(l.crossEnd, crossEnd));
    if (matches.length === 0) return null;
    matches.sort((a, b) => (a.crossEnd - a.crossStart) - (b.crossEnd - b.crossStart));
    return matches[0];
  };

  function collectBoundPanels(node: Node) {
    if (node.type === 'leaf') {
      const rect = geometryMap.get(node.id);
      if (!rect) return;
      leafPanels.push({
        id: node.id,
        // 🌟 唯一修改：获取真实属性
        minSize: getProps(node as LeafNode).minSize ?? 40,
        leftLineId: getBestLine(grid.vLines, rect.x, rect.y, rect.y + rect.height)?.id || null,
        rightLineId: getBestLine(grid.vLines, rect.x + rect.width, rect.y, rect.y + rect.height)?.id || null,
        topLineId: getBestLine(grid.hLines, rect.y, rect.x, rect.x + rect.width)?.id || null,
        bottomLineId: getBestLine(grid.hLines, rect.y + rect.height, rect.x, rect.x + rect.width)?.id || null,
      });
      return;
    }
    collectBoundPanels(node.children[0]);
    collectBoundPanels(node.children[1]);
  }
  collectBoundPanels(tree);

  let edges = leafPanels.map(p => ({
    from: direction === 'horizontal' ? (p.leftLineId || 'START') : (p.topLineId || 'START'),
    to: direction === 'horizontal' ? (p.rightLineId || 'END') : (p.bottomLineId || 'END'),
    weight: p.minSize
  }));

  const totalDist = getLongestPath('START', edges).get('END') ?? 0;
  const maxBound = direction === 'horizontal' ? viewport.width : viewport.height;
  if (totalDist > maxBound && maxBound > 0) {
    const scale = maxBound / totalDist;
    edges = edges.map(e => ({ ...e, weight: e.weight * scale }));
  }

  return { splitId, direction, initialPositions, viewportWidth: viewport.width, viewportHeight: viewport.height, leafPanels, config, mode, edges };
}

export function simulatePush(ctx: DragContext, intendedDelta: number): { positions: Map<string, number>; blocked: boolean } {
  const positions = new Map(ctx.initialPositions);
  const { splitId, direction, viewportWidth, viewportHeight, edges, initialPositions } = ctx;
  const maxBound = direction === 'horizontal' ? viewportWidth : viewportHeight;

  const distFromStart = getLongestPath('START', edges);
  const distFromSplit = getLongestPath(splitId, edges);

  const reverseEdges = edges.map(e => ({ from: e.to, to: e.from, weight: e.weight }));
  const distFromEndRev = getLongestPath('END', reverseEdges);
  const distFromSplitRev = getLongestPath(splitId, reverseEdges);

  const minAllowed = distFromStart.get(splitId) ?? 0;
  const maxAllowed = maxBound - (distFromEndRev.get(splitId) ?? 0);

  const initialPos = initialPositions.get(splitId)!;
  const targetPos = initialPos + intendedDelta;
  let clampedPos = targetPos;

  if (ctx.mode === 'simple') {
    let simpleMin = 0;
    let simpleMax = maxBound;
    edges.forEach(e => {
      if (e.to === splitId) {
        const limit = (e.from === 'START' ? 0 : initialPositions.get(e.from)!) + e.weight;
        if (limit > simpleMin) simpleMin = limit;
      }
      if (e.from === splitId) {
        const limit = (e.to === 'END' ? maxBound : initialPositions.get(e.to)!) - e.weight;
        if (limit < simpleMax) simpleMax = limit;
      }
    });
    clampedPos = Math.max(Math.max(simpleMin, minAllowed), Math.min(Math.min(simpleMax, maxAllowed), targetPos));
    positions.set(splitId, clampedPos);
  } else {
    clampedPos = Math.max(minAllowed, Math.min(maxAllowed, targetPos));
    positions.set(splitId, clampedPos);

    if (clampedPos > initialPos) {
      distFromSplit.forEach((dist, nodeId) => {
        if (nodeId !== 'START' && nodeId !== 'END' && nodeId !== splitId) {
          const currentP = initialPositions.get(nodeId)!;
          const pushedP = clampedPos + dist;
          if (pushedP > currentP) positions.set(nodeId, pushedP);
        }
      });
    } else if (clampedPos < initialPos) {
      distFromSplitRev.forEach((dist, nodeId) => {
        if (nodeId !== 'START' && nodeId !== 'END' && nodeId !== splitId) {
          const currentP = initialPositions.get(nodeId)!;
          const pushedP = clampedPos - dist;
          if (pushedP < currentP) positions.set(nodeId, pushedP);
        }
      });
    }
  }

  return { positions, blocked: clampedPos !== targetPos };
}

export function rebuildTreeRatios(node: Node, rect: Rect, linePositions: Map<string, number>, ctx: DragContext): Node {
  if (node.type === 'leaf') return { ...node };
  
  const pos = linePositions.get(node.id);
  let ratio = node.ratio;
  let rect1: Rect, rect2: Rect;
  
  if (node.direction === 'horizontal') {
    if (pos !== undefined && ctx.direction === 'horizontal') {
      const leftWidth = pos - rect.x;
      ratio = rect.width > 0 ? leftWidth / rect.width : 0.5;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    const leftW = Math.round(rect.width * ratio);
    rect1 = { x: rect.x, y: rect.y, width: leftW, height: rect.height };
    rect2 = { x: rect.x + leftW, y: rect.y, width: rect.width - leftW, height: rect.height };
  } else {
    if (pos !== undefined && ctx.direction === 'vertical') {
      const topHeight = pos - rect.y;
      ratio = rect.height > 0 ? topHeight / rect.height : 0.5;
    }
    ratio = Math.max(0, Math.min(1, ratio));
    const topH = Math.round(rect.height * ratio);
    rect1 = { x: rect.x, y: rect.y, width: rect.width, height: topH };
    rect2 = { x: rect.x, y: rect.y + topH, width: rect.width, height: rect.height - topH };
  }

  return {
    ...node,
    ratio,
    children: [
      rebuildTreeRatios(node.children[0], rect1, linePositions, ctx),
      rebuildTreeRatios(node.children[1], rect2, linePositions, ctx),
    ],
  } as Node;
}

export function unlockAndSyncRatios(
  node: Node,
  affectedIds: Set<string>,
  geoMap: GeometryMap
): Node {
  if (node.type === 'leaf') {
    const n = node as any;
    if (affectedIds.has(n.id) && n.isFixed) {
      return { ...node, isFixed: false, fixedSize: undefined } as Node;
    }
    return node;
  }

  const child1 = node.children[0];
  const child2 = node.children[1];
  const c1Rect = geoMap.get(child1.id);
  const c2Rect = geoMap.get(child2.id);

  let exactRatio = node.ratio;
  if (c1Rect && c2Rect) {
    if (node.direction === 'horizontal') {
      const totalW = c1Rect.width + c2Rect.width;
      if (totalW > 0) exactRatio = c1Rect.width / totalW;
    } else {
      const totalH = c1Rect.height + c2Rect.height;
      if (totalH > 0) exactRatio = c1Rect.height / totalH;
    }
  }

  return {
    ...node,
    ratio: exactRatio,
    children: [
      unlockAndSyncRatios(child1, affectedIds, geoMap),
      unlockAndSyncRatios(child2, affectedIds, geoMap)
    ]
  } as Node;
}