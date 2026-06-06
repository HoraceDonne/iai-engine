// src/plugins/operator/operators/dragStart.ts
import type { Operator } from '../types';

export const dragStart: Operator = {
  id: 'drag.start',
  execute({ engine, props }) {
    const {
      sourceId,
      initialX,
      initialY,
      threshold = 5,
      detectHover = false,
    } = props;

    if (typeof initialX !== 'number' || typeof initialY !== 'number') return;

    const sourceEntity = engine.getAny(sourceId);
    if (!sourceEntity) return;
    const sourceType = engine.getFree(sourceId) ? 'float' : 'grid';

    let startX = initialX;
    let startY = initialY;
    let isDragging = false;
    let hasMoved = false;
    let rafId: number | null = null;
    let hoveredPanelId: string | null = null;

    let shield: HTMLDivElement | null = null;
    let cancelled = false;                    // 🌟 取消标志

    const cleanup = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (shield) {
        shield.remove();
        shield = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cancelled) return;
      if (!hasMoved) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx < threshold && dy < threshold) return;
        hasMoved = true;
        isDragging = true;

        shield = document.createElement('div');
        shield.style.cssText = 'position:fixed;inset:0;z-index:99999;cursor:inherit;';
        document.body.appendChild(shield);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = sourceType === 'float' ? 'move' : 'grabbing';

        engine.events.emit('drag:start', { sourceId, sourceType });
      }

      if (!isDragging) return;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          let panelId: string | null = null;

          if (detectHover) {
            if (shield) shield.style.display = 'none';
            const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
            panelId = elemBelow?.closest?.('[data-node-id]')?.getAttribute?.('data-node-id') || null;
            if (shield) shield.style.display = '';
          }

          if (panelId !== hoveredPanelId) {
            hoveredPanelId = panelId;
          }

          engine.events.emit('drag:move', {
            sourceId,
            sourceType,
            x: e.clientX,
            y: e.clientY,
            deltaX: e.clientX - startX,
            deltaY: e.clientY - startY,
            hoveredPanelId,
          });

          rafId = null;
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (cancelled) return;
      cleanup();

      if (isDragging) {
        let finalPanelId: string | null = null;
        if (detectHover) {
          const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
          finalPanelId = elemBelow?.closest?.('[data-node-id]')?.getAttribute?.('data-node-id') || null;
        }

        engine.events.emit('drag:end', {
          sourceId,
          sourceType,
          endX: e.clientX,
          endY: e.clientY,
          deltaX: e.clientX - startX,
          deltaY: e.clientY - startY,
          hoveredPanelId: finalPanelId,
        });
      }
    };

    // 用于键盘取消（默认 Escape）
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancel();
      }
    };

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      // 发射一个假的 drag:end ？ 不发射，外部通过 cancel 感知。
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);   // 全局 Escape 取消

    return { cancel };   // 🌟 返回取消函数
  },
};