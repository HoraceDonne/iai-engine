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
    // 🌟 1. 获取 Docking 插件实例，以便读取配置
    const dockingPlugin = engine.getPlugins().find((p: any) => p.name === 'DockingPlugin') as any;
    
    if (!opPlugin) return;
    
    // 🌟 2. 提取配置，提供安全兜底默认值
    const config = dockingPlugin?.config || {};
    const dragThreshold = config.dragThreshold ?? 5;
    const edgeRatio = config.edgeRatio ?? 0.3;
    const centerRatio = config.centerRatio ?? 0.4;

    opPlugin.exec('drag.start', {
      sourceId,
      initialX,
      initialY,
      threshold: dragThreshold, // 🌟 绑定拖拽阈值
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

      // 🌟 3. 将比例配置传入五宫格计算函数
      const zone = calculateDropZone(data.x, data.y, targetRect, edgeRatio, centerRatio);
      lastZone = zone;
      lastTargetId = hoveredId;
      dockingState.targetId = hoveredId;
      dockingState.zone = zone;
      
      // 🌟 4. 由操作符利用配置比例计算精确矩形
      dockingState.rect = getExactHighlightRect(targetRect, zone, edgeRatio, centerRatio);
    };

    const onEnd = () => {
      dockingState.targetId = null;
      dockingState.zone = null;
      dockingState.rect = null;
      if (lastZone && lastTargetId) {
        executePanelDocking(engine, sourceId, lastTargetId, lastZone, edgeRatio);
      }
      engine.events.off('drag:move', onMove);
      engine.events.off('drag:end', onEnd);
    };

    engine.events.on('drag:move', onMove);
    engine.events.on('drag:end', onEnd);
  },
};

// ── 辅助函数 ──

/** 🌟 核心改进：根据传入的 edgeRatio 和 centerRatio 动态计算高亮像素 */
function getExactHighlightRect(rect: Rect, zone: DropZone, edgeRatio: number, centerRatio: number): Rect {
  if (zone === 'center' || !zone) {
    // 按照 centerRatio 比例居中计算矩形（例如 0.4 就是长宽都占 40%，并居中）
    const w = rect.width * centerRatio;
    const h = rect.height * centerRatio;
    return {
      x: rect.x + (rect.width - w) / 2,
      y: rect.y + (rect.height - h) / 2,
      width: w,
      height: h
    };
  }
  
  let { x, y, width, height } = rect;
  
  // 按照 edgeRatio 计算边缘高亮矩形（例如 0.3 就是占边长的 30%）
  if (zone === 'left') { width *= edgeRatio; }
  if (zone === 'right') { width *= edgeRatio; x += rect.width - width; }
  if (zone === 'top') { height *= edgeRatio; }
  if (zone === 'bottom') { height *= edgeRatio; y += rect.height - height; }
  
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

function executePanelDocking(engine: any, sourceId: string, targetId: string, zone: DropZone, edgeRatio: number) {
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
  
  // 🌟 面板切分比例，保持 0.5 对半分，这样 UI 最美观
  engine.splitNode(targetId, direction, 0.5, newLeaf, insertAsSecond);
}