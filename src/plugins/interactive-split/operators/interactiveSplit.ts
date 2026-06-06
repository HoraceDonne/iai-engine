// src/plugins/interactive-split/operators/interactiveSplit.ts
import type { Operator } from '../../operator/types';
import { splitState } from '../state';
import type { Rect } from '../../../core/types';
import type { InteractiveSplitPlugin } from '../index';

export const interactiveSplitStart: Operator = {
  id: 'interactive.split.start',
  execute({ engine, props }) {
    if (splitState.isActive) return;

    const { mode = 'horizontal', newPanelType, sourceId, event } = props;
    if (!sourceId || !event) return;

    const targetEntity = engine.getAny(sourceId);
    if (!targetEntity) return;

    const plugin = engine.getPlugins().find(
      (p: any) => p.name === 'InteractiveSplitPlugin'
    ) as InteractiveSplitPlugin;
    const config = plugin?.config || {};
    const cancelKey = config.cancelKey ?? 'Escape';
    const cancelButton = config.cancelButton ?? 2;

    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (!opPlugin) return;

    // 所有前置检查通过后才激活
    splitState.isActive = true;
    splitState.mode = mode as 'horizontal' | 'vertical';
    splitState.direction = splitState.mode;
    splitState.newPanelType = newPanelType;
    splitState.sourceId = sourceId;
    splitState.isSnapped = false;
    splitState.isHovering = false;

    let dragHasMoved = false;           // 是否已经触发过 drag:move
    let dragCancelFn: (() => void) | null = null;
    let cleaned = false;

    const vp = engine.getViewport();

    const getTargetRect = (): Rect | null => {
      const geoMap = engine.getGeoMap(vp.width || window.innerWidth, vp.height || window.innerHeight);
      const fp = engine.getFree(sourceId);
      if (fp) return { x: fp.x, y: fp.y, width: fp.width, height: fp.height };
      return geoMap.get(sourceId) || null;
    };

    const updatePreview = (x: number, y: number) => {
      const targetRect = getTargetRect();
      if (!targetRect) {
        splitState.isHovering = false;
        return;
      }

      if (x < targetRect.x || x > targetRect.x + targetRect.width ||
          y < targetRect.y || y > targetRect.y + targetRect.height) {
        splitState.isHovering = false;
        return;
      }

      const panelProps = engine.getPanelProps(targetEntity);
      const minSize = panelProps?.minSize ?? 40;

      let offsetPixels = splitState.direction === 'horizontal'
        ? x - targetRect.x
        : y - targetRect.y;

      let totalSize: number;
      if (splitState.direction === 'horizontal') {
        totalSize = targetRect.width;
      } else {
        totalSize = targetRect.height;
      }

      if (totalSize >= 2 * minSize) {
        offsetPixels = Math.max(minSize, Math.min(totalSize - minSize, offsetPixels));
      } else {
        offsetPixels = totalSize / 2;
      }

      let exactX = targetRect.x;
      let exactY = targetRect.y;
      if (splitState.direction === 'horizontal') {
        exactX = targetRect.x + offsetPixels;
      } else {
        exactY = targetRect.y + offsetPixels;
      }

      let isSnapped = false;
      if (config.snapToCenter) {
        const centerX = targetRect.x + targetRect.width / 2;
        const centerY = targetRect.y + targetRect.height / 2;
        if (splitState.direction === 'horizontal' && Math.abs(exactX - centerX) < (config.snapThreshold ?? 15)) {
          exactX = centerX;
          isSnapped = true;
        }
        if (splitState.direction === 'vertical' && Math.abs(exactY - centerY) < (config.snapThreshold ?? 15)) {
          exactY = centerY;
          isSnapped = true;
        }
      }

      splitState.isHovering = true;
      splitState.isSnapped = isSnapped;

      if (splitState.direction === 'horizontal') {
        splitState.x = exactX;
        splitState.y = targetRect.y;
        splitState.length = targetRect.height;
      } else {
        splitState.x = targetRect.x;
        splitState.y = exactY;
        splitState.length = targetRect.width;
      }
    };

    // ── 拖拽事件处理 ──
    const onDragMove = (data: any) => {
      if (data.sourceId !== sourceId || cleaned) return;
      dragHasMoved = true;                      // 真正发生了拖拽
      const el = document.querySelector('.iai-layout-container') as HTMLElement;
      let localX = data.x;
      let localY = data.y;
      if (el) {
        const rect = el.getBoundingClientRect();
        localX = data.x - rect.left;
        localY = data.y - rect.top;
      }
      updatePreview(localX, localY);
    };

    const onDragEnd = (data: any) => {
      if (data.sourceId !== sourceId || cleaned) return;
      engine.events.off('drag:move', onDragMove);
      engine.events.off('drag:end', onDragEnd);

      if (!splitState.isHovering) {
        cancelSplit();
        return;
      }

      const targetRect = getTargetRect();
      if (!targetRect) {
        cancelSplit();
        return;
      }

      const panelProps = engine.getPanelProps(targetEntity);
      const minSize = panelProps?.minSize ?? 40;

      let offsetPixels = splitState.direction === 'horizontal'
        ? splitState.x - targetRect.x
        : splitState.y - targetRect.y;

      let totalSize: number;
      if (splitState.direction === 'horizontal') {
        totalSize = targetRect.width;
      } else {
        totalSize = targetRect.height;
      }

      if (totalSize < 2 * minSize) {
        cancelSplit();
        return;
      }

      offsetPixels = Math.max(minSize, Math.min(totalSize - minSize, offsetPixels));
      const ratio = totalSize > 0 ? offsetPixels / totalSize : 0.5;

      opPlugin.exec('panel.split', {
        targetId: sourceId,
        direction: splitState.direction,
        ratio: ratio,
        panelType: splitState.newPanelType,
        insertAsSecond: true,
      });

      cancelSplit();
    };

    // 全局 pointerup 兜底：若用户没有真正拖拽就松手，直接取消
    const onPointerUp = (e: PointerEvent) => {
      if (cleaned) return;
      if (!dragHasMoved) {
        // 没有触发过 drag:move，说明拖拽未启动，立即重置状态
        cancelSplit();
      }
    };

    const cancelSplit = () => {
      if (cleaned) return;
      cleaned = true;
      splitState.isActive = false;
      splitState.isHovering = false;

      // 如果通用拖拽提供了 cancel，调用它（清理内部监听和护盾）
      if (dragCancelFn) {
        dragCancelFn();
        dragCancelFn = null;
      }

      engine.events.off('drag:move', onDragMove);
      engine.events.off('drag:end', onDragEnd);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('contextmenu', onContextMenu);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === cancelKey) cancelSplit();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (cancelButton === 2) {
        e.preventDefault();
        cancelSplit();
      }
    };

    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', onContextMenu);

    const dragControl = opPlugin.exec('drag.start', {
      sourceId,
      initialX: event.clientX,
      initialY: event.clientY,
      threshold: 5,
      detectHover: false,
    });

    if (dragControl && typeof dragControl.cancel === 'function') {
      dragCancelFn = dragControl.cancel;
    } else {
      // 启动失败
      cancelSplit();
      return;
    }

    engine.events.on('drag:move', onDragMove);
    engine.events.on('drag:end', onDragEnd);
  },
};

export const interactiveSplitCancel: Operator = {
  id: 'interactive.split.cancel',
  execute() {
    // 由 cancelSplit 处理
  },
};