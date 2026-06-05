// src/plugins/docking/operators/dockingPanel.ts
import type { Operator } from '../../operator/types';
import { calculateDropZone, type DropZone } from '../core';
import { dockingState } from '../state';
import type { Rect } from '../../../core/types';

export const dockingPanel: Operator = {
  id: 'docking.panel',
  execute({ engine, props }) {
    const { sourceId, initialX, initialY } = props;
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (!opPlugin) return;
    
    opPlugin.exec('drag.start', {
      sourceId,
      initialX,
      initialY,
      threshold: 5,
      detectHover: true,
    });
    
    let lastZone: DropZone = null;
    let lastTargetId: string | null = null;
    
    const onMove = (data: any) => {
      if (data.sourceId !== sourceId) return;
      const hoveredId = data.hoveredPanelId;
      
      if (!hoveredId || hoveredId === sourceId) {
        dockingState.targetId = null;
        dockingState.zone = null;
        dockingState.rect = null;
        lastZone = null;
        lastTargetId = null;
        return;
      }

      const targetRect = getTargetRect(engine, hoveredId);
      if (!targetRect) return;

      const zone = calculateDropZone(data.x, data.y, targetRect);
      lastZone = zone;
      lastTargetId = hoveredId;
      dockingState.targetId = hoveredId;
      dockingState.zone = zone;
      
      // 🌟 核心改进：由操作符计算精确的半区像素级矩形，不再依赖视图组件去除以 2
      dockingState.rect = getExactHighlightRect(targetRect, zone);
    };

    const onEnd = () => {
      dockingState.targetId = null;
      dockingState.zone = null;
      dockingState.rect = null;
      if (lastZone && lastTargetId) {
        executePanelDocking(engine, sourceId, lastTargetId, lastZone);
      }
      engine.events.off('drag:move', onMove);
      engine.events.off('drag:end', onEnd);
    };

    engine.events.on('drag:move', onMove);
    engine.events.on('drag:end', onEnd);
  },
};

// ── 辅助函数 ──

/** 根据 5 宫格方向，在数据层精确切分出应该高亮的矩形像素 */
function getExactHighlightRect(rect: Rect, zone: DropZone): Rect {
  if (zone === 'center' || !zone) return { ...rect };
  let { x, y, width, height } = rect;
  
  if (zone === 'left') { width /= 2; }
  if (zone === 'right') { width /= 2; x += width; }
  if (zone === 'top') { height /= 2; }
  if (zone === 'bottom') { height /= 2; y += height; }
  
  return { x, y, width, height };
}

function getTargetRect(engine: any, id: string) {
  const vp = engine.getViewport();
  const geoMap = engine.getGeoMap(vp.width || window.innerWidth, vp.height || window.innerHeight);
  const gridRect = geoMap.get(id);
  if (gridRect) return gridRect;
  
  const free = engine.getFree(id);
  if (free) return { x: free.x, y: free.y, width: free.width, height: free.height };

  return null;
}

function executePanelDocking(engine: any, sourceId: string, targetId: string, zone: DropZone) {
  const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
  if (!opPlugin) return;

  if (zone === 'center') {
    const src = engine.getAny(sourceId), tgt = engine.getAny(targetId);
    if (!src || !tgt) return;
    const srcType = src.panelType;
    opPlugin.exec('panel.switch', { targetId: sourceId, newType: tgt.panelType });
    opPlugin.exec('panel.switch', { targetId: targetId, newType: srcType });
    return;
  }

  const sourceData = engine.getAny(sourceId);
  if (!sourceData) return;
  engine.getFree(sourceId) ? engine.removeFree(sourceId) : engine.deleteNode(sourceId);

  const direction = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical';
  const insertAsSecond = (zone === 'right' || zone === 'bottom');
  
  const newLeaf = { ...sourceData, type: 'leaf' };
  
  // 面板内停靠直接平分即可 (ratio 0.5)
  engine.splitNode(targetId, direction, 0.5, newLeaf, insertAsSecond);
}