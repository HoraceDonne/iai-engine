// src/plugins/docking/operators/dockingGlobal.ts
import type { Operator } from '../../operator/types';
import { dockingState } from '../state';

type EdgeZone = 'left' | 'right' | 'top' | 'bottom';

export const dockingGlobal: Operator = {
  id: 'docking.global',
  execute({ engine, props }) {
    const { sourceId, initialX, initialY } = props;
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    // 🌟 1. 获取 Docking 插件实例
    const dockingPlugin = engine.getPlugins().find((p: any) => p.name === 'DockingPlugin') as any;
    if (!opPlugin) return;

    // 🌟 2. 读取配置，注入动态阈值
    const config = dockingPlugin?.config || {};
    const globalEdgeThreshold = config.globalEdgeThreshold ?? 120;
    const dragThreshold = config.dragThreshold ?? 5;

    const sourceData = engine.getAny(sourceId);
    if (!sourceData) return;
    const realProps = engine.getPanelProps(sourceData);
    const defaultW = realProps.defaultWidth;
    const defaultH = realProps.defaultHeight;

    opPlugin.exec('drag.start', {
      sourceId,
      initialX,
      initialY,
      threshold: dragThreshold, // 🌟 绑定拖拽阈值
      detectHover: false,
    });

    let lastZone: EdgeZone | null = null;

    const onMove = (data: any) => {
      if (data.sourceId !== sourceId) return;

      const localX = data.x;
      const localY = data.y;

      const vp = engine.getViewport();
      const containerW = vp.width || window.innerWidth;
      const containerH = vp.height || window.innerHeight;

      const distLeft = Math.abs(localX);
      const distRight = Math.abs(localX - containerW);
      const distTop = Math.abs(localY);
      const distBottom = Math.abs(localY - containerH);

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      let zone: EdgeZone | null = null;

      // 🌟 3. 使用配置项中的全局边缘阈值
      if (minDist <= globalEdgeThreshold) {
        if (minDist === distLeft) zone = 'left';
        else if (minDist === distRight) zone = 'right';
        else if (minDist === distTop) zone = 'top';
        else if (minDist === distBottom) zone = 'bottom';
      }

      lastZone = zone;
      dockingState.zone = zone;
      dockingState.rect = zone
        ? getEdgeRect(zone, containerW, containerH, defaultW, defaultH)
        : null;
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

function getEdgeRect(zone: EdgeZone, containerW: number, containerH: number, defaultW?: number, defaultH?: number) {
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
  const direction = zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical';
  const insertAsSecond = zone === 'right' || zone === 'bottom';
  const newLeaf = { ...sourceData, type: 'leaf' };
  const root = engine.getRoot();
  if (!root) { engine.mount(newLeaf, true); return; }
  const layoutEl = document.querySelector('.iai-layout-container');
  const containerW = layoutEl?.clientWidth || window.innerWidth;
  const containerH = layoutEl?.clientHeight || window.innerHeight;
  const realProps = engine.getPanelProps(sourceData);
  let ratio = 0.5;
  if (direction === 'horizontal') {
    const targetW = realProps.defaultWidth ? Math.min(realProps.defaultWidth, containerW * 0.5) : containerW * 0.2;
    ratio = targetW / containerW;
  } else {
    const targetH = realProps.defaultHeight ? Math.min(realProps.defaultHeight, containerH * 0.5) : containerH * 0.2;
    ratio = targetH / containerH;
  }
  engine.mount({ type: 'split', id: `split-${Date.now()}`, direction, ratio: insertAsSecond ? 1 - ratio : ratio, children: insertAsSecond ? [root, newLeaf] : [newLeaf, root] }, true);
}