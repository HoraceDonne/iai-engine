// src/plugins/docking/operators/dockingGlobal.ts
import type { Operator } from '../../operator/types';
import { dockingState } from '../state';

const EDGE_THRESHOLD = 30;

type EdgeZone = 'left' | 'right' | 'top' | 'bottom';

export const dockingGlobal: Operator = {
  id: 'docking.global',
  execute({ engine, props }) {
    const { sourceId, initialX, initialY } = props;
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (!opPlugin) return;

    // 🌟 获取源面板的真实图纸属性
    const sourceData = engine.getAny(sourceId);
    if (!sourceData) return;
    const realProps = engine.getPanelProps(sourceData);
    
    // 取出配置的真实默认宽高，可能为 undefined
    const defaultW = realProps.defaultWidth;
    const defaultH = realProps.defaultHeight;

    opPlugin.exec('drag.start', {
      sourceId,
      initialX,
      initialY,
      threshold: 5,
      detectHover: true,
    });

    let lastZone: EdgeZone | null = null;

    const onMove = (data: any) => {
      if (data.sourceId !== sourceId) return;
      if (data.hoveredPanelId && data.hoveredPanelId !== sourceId) {
        dockingState.zone = null;
        dockingState.rect = null;
        lastZone = null;
        return;
      }

      const localX = data.x;
      const localY = data.y;
      const vp = engine.getViewport();
      const containerW = vp.width || window.innerWidth;
      const containerH = vp.height || window.innerHeight;

      const zone = detectEdge(localX, localY, containerW, containerH);
      lastZone = zone;
      dockingState.zone = zone;
      
      // 直接计算出需要渲染的最终绝对像素坐标
      dockingState.rect = zone ? getEdgeRect(zone, containerW, containerH, defaultW, defaultH) : null;
    };

    const onEnd = () => {
      dockingState.zone = null;
      dockingState.rect = null;
      if (lastZone) {
        executeGlobalDocking(engine, sourceId, lastZone);
      }
      engine.events.off('drag:move', onMove);
      engine.events.off('drag:end', onEnd);
    };

    engine.events.on('drag:move', onMove);
    engine.events.on('drag:end', onEnd);
  },
};

// ── 辅助函数 ──

function detectEdge(x: number, y: number, w: number, h: number): EdgeZone | null {
  if (x <= EDGE_THRESHOLD) return 'left';
  if (x >= w - EDGE_THRESHOLD) return 'right';
  if (y <= EDGE_THRESHOLD) return 'top';
  if (y >= h - EDGE_THRESHOLD) return 'bottom';
  return null;
}

function getEdgeRect(zone: EdgeZone, containerW: number, containerH: number, defaultW?: number, defaultH?: number) {
  // 🌟 核心逻辑：如果图纸里传了真实像素，就用（但不超过屏幕一半）。如果没传，使用 20% (0.2) 默认比例。
  const targetW = defaultW ? Math.min(defaultW, containerW * 0.5) : containerW * 0.2;
  const targetH = defaultH ? Math.min(defaultH, containerH * 0.5) : containerH * 0.2;

  if (zone === 'left') return { x: 0, y: 0, width: targetW, height: containerH };
  if (zone === 'right') return { x: containerW - targetW, y: 0, width: targetW, height: containerH };
  if (zone === 'top') return { x: 0, y: 0, width: containerW, height: targetH };
  if (zone === 'bottom') return { x: 0, y: containerH - targetH, width: containerW, height: targetH };
  return null;
}

function executeGlobalDocking(engine: any, sourceId: string, zone: EdgeZone) {
  const sourceData = engine.getAny(sourceId);
  if (!sourceData) return;

  engine.getFree(sourceId) ? engine.removeFree(sourceId) : engine.deleteNode(sourceId);

  const direction = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical';
  const insertAsSecond = (zone === 'right' || zone === 'bottom');

  const newLeaf = { ...sourceData, type: 'leaf' };

  const root = engine.getRoot();
  if (!root) {
    engine.mount(newLeaf, true);
    return;
  }

  const vp = engine.getViewport();
  const containerW = vp.width || window.innerWidth;
  const containerH = vp.height || window.innerHeight;

  const realProps = engine.getPanelProps(sourceData);
  let ratio = 0.5;
  
  // 🌟 反算出最终插入树节点时的比例
  if (direction === 'horizontal') {
    const targetW = realProps.defaultWidth ? Math.min(realProps.defaultWidth, containerW * 0.5) : containerW * 0.2;
    ratio = targetW / containerW;
  } else {
    const targetH = realProps.defaultHeight ? Math.min(realProps.defaultHeight, containerH * 0.5) : containerH * 0.2;
    ratio = targetH / containerH;
  }

  engine.mount(
    {
      type: 'split',
      id: `split-${Date.now()}`,
      direction,
      ratio: insertAsSecond ? 1 - ratio : ratio,
      children: insertAsSecond ? [root, newLeaf] : [newLeaf, root],
    },
    true
  );
}