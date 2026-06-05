// src/plugins/interactive-split/operators/interactiveSplit.ts
import type { Operator } from '../../operator/types';
import { splitState } from '../state';
import type { GeometryMap, Rect } from '../../../core/types';
import type { InteractiveSplitPlugin } from '../index';

let cleanupFn: (() => void) | null = null;

export const interactiveSplitStart: Operator = {
  id: 'interactive.split.start',
  execute({ engine, props }) {
    if (splitState.isActive) return;

    // 🌟 支持高度配置：取消按键、取消鼠标键（默认右键2，传 null 禁用）
    const { 
      mode = 'horizontal', 
      newPanelType, 
      sourceId, 
      cancelKey = 'Escape', 
      cancelButton = 2 
    } = props;
    
    if (!sourceId) {
      console.warn('[IaiEngine] interactive.split.start 必须传入 sourceId');
      return;
    }

    splitState.isActive = true;
    splitState.mode = mode as 'horizontal' | 'vertical';
    splitState.direction = splitState.mode;
    splitState.newPanelType = newPanelType;
    splitState.sourceId = sourceId;

    const plugin = engine.getPlugins().find((p: any) => p.name === 'InteractiveSplitPlugin') as InteractiveSplitPlugin;
    const config = plugin?.config;
    if (!config) return;

    const vp = engine.getViewport();

    const onMove = (e: PointerEvent) => {
      const { x, y } = getContainerOffset(e);
      const geoMap = engine.getGeoMap(vp.width || window.innerWidth, vp.height || window.innerHeight);
      
      // 🌟 直接拿唯一目标面板的矩形，不再循环找别人！
      const targetRect = getTargetRect(engine, geoMap, splitState.sourceId!);

      // 如果目标面板不存在，或者鼠标超出了它的范围，立刻隐藏线条
      if (!targetRect || x < targetRect.x || x > targetRect.x + targetRect.width || y < targetRect.y || y > targetRect.y + targetRect.height) {
        splitState.isHovering = false;
        return;
      }

      splitState.isHovering = true;
      const dir = splitState.mode;

      let exactX = x;
      let exactY = y;
      let isSnapped = false;

      // 中点吸附
      if (config.snapToCenter) {
        const centerX = targetRect.x + targetRect.width / 2;
        const centerY = targetRect.y + targetRect.height / 2;
        
        if (dir === 'horizontal' && Math.abs(x - centerX) < config.snapThreshold) {
          exactX = centerX;
          isSnapped = true;
        }
        if (dir === 'vertical' && Math.abs(y - centerY) < config.snapThreshold) {
          exactY = centerY;
          isSnapped = true;
        }
      }

      splitState.isSnapped = isSnapped;

      if (dir === 'horizontal') {
        splitState.x = exactX;
        splitState.y = targetRect.y;
        splitState.length = targetRect.height;
      } else {
        splitState.x = targetRect.x;
        splitState.y = exactY;
        splitState.length = targetRect.width;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      // 🌟 1. 匹配自定义的取消鼠标键 (比如右键 e.button === 2)
      if (cancelButton !== null && e.button === cancelButton) {
        cancel();
        return;
      }

      // 🌟 2. 只有左键 (0) 才能进行切割
      if (e.button !== 0) return;

      // 🌟 3. 如果点击时鼠标不在源面板内部，直接视作取消操作
      if (!splitState.isHovering) {
        cancel();
        return;
      }

      const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
      if (opPlugin) {
        const geoMap = engine.getGeoMap(vp.width || window.innerWidth, vp.height || window.innerHeight);
        const targetRect = getTargetRect(engine, geoMap, splitState.sourceId!);

        if (targetRect) {
          const offsetPixels = splitState.direction === 'horizontal' 
            ? splitState.x - targetRect.x 
            : splitState.y - targetRect.y;

          opPlugin.exec('panel.split', {
            targetId: splitState.sourceId,
            direction: splitState.direction,
            pixels: offsetPixels,
            panelType: splitState.newPanelType,
            insertAsSecond: true
          });
        }
      }
      cancel();
    };

    const onKeydown = (e: KeyboardEvent) => {
      // 🌟 匹配自定义的取消键盘按键
      if (cancelKey && e.key === cancelKey) {
        cancel();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      // 如果是用右键取消，必须阻止系统默认的右键菜单弹出
      if (cancelButton === 2) {
        e.preventDefault();
      }
    };

    const cancel = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('contextmenu', onContextMenu);
      splitState.isActive = false;
      splitState.isHovering = false;
      cleanupFn = null;
    };

    cleanupFn = cancel;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('contextmenu', onContextMenu);
  }
};

export const interactiveSplitCancel: Operator = {
  id: 'interactive.split.cancel',
  execute() {
    if (cleanupFn) cleanupFn();
  }
};

// ── 辅助函数 ──
function getContainerOffset(e: PointerEvent) {
  const el = document.querySelector('.iai-layout-container') as HTMLElement;
  if (!el) return { x: e.clientX, y: e.clientY };
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getTargetRect(engine: any, geoMap: GeometryMap, id: string): Rect | null {
  const fp = engine.getFree(id);
  if (fp) return { x: fp.x, y: fp.y, width: fp.width, height: fp.height };
  return geoMap.get(id) || null;
}