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

    if (typeof initialX !== 'number' || typeof initialY !== 'number') {
      console.warn('[drag.start] 需要传入 initialX 和 initialY');
      return;
    }

    const sourceEntity = engine.getAny(sourceId);
    if (!sourceEntity) return;

    const sourceType = engine.getFree(sourceId) ? 'float' : 'grid';

    let startX = initialX;
    let startY = initialY;
    let currentGlobalX = initialX;
    let currentGlobalY = initialY;
    let isDragging = false;
    let hasMoved = false;
    let rafId: number | null = null;
    let hoveredPanelId: string | null = null;

    if (sourceType === 'float') {
      const fp = engine.getFree(sourceId);
      if (fp) {
        fp.panel.ignoreHover = true;
        engine.events.emit('free:update', { count: engine.getAllFree().length });
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      currentGlobalX = e.clientX;
      currentGlobalY = e.clientY;

      if (!hasMoved) {
        const dx = Math.abs(currentGlobalX - startX);
        const dy = Math.abs(currentGlobalY - startY);
        if (dx < threshold && dy < threshold) return;
        hasMoved = true;
        isDragging = true;

        engine.events.emit('drag:shield', {
          active: true,
          cursor: sourceType === 'float' ? 'move' : 'grabbing',
        });
        engine.events.emit('drag:start', { sourceId, sourceType });
      }

      if (!isDragging) return;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          let panelId: string | null = null;
          let localX = currentGlobalX;
          let localY = currentGlobalY;

          if (detectHover) {
            const container = document.querySelector('.iai-layout-container');
            if (container) {
              const rect = container.getBoundingClientRect();
              localX = currentGlobalX - rect.left;
              localY = currentGlobalY - rect.top;
            }

            // 临时隐藏被拖拽面板，避免检测到自身
            const selfEl = document.querySelector(`[data-node-id="${sourceId}"]`) as HTMLElement;
            const prevDisplay = selfEl?.style.display ?? '';
            if (selfEl) selfEl.style.display = 'none';

            const elemBelow = document.elementFromPoint(currentGlobalX, currentGlobalY);
            panelId = elemBelow?.closest?.('[data-node-id]')?.getAttribute?.('data-node-id') || null;

            if (selfEl) selfEl.style.display = prevDisplay;
          }

          if (panelId !== hoveredPanelId) {
            hoveredPanelId = panelId;
          }

          engine.events.emit('drag:move', {
            sourceId,
            sourceType,
            x: localX,
            y: localY,
            deltaX: localX - startX,
            deltaY: localY - startY,
            hoveredPanelId,
          });

          rafId = null;
        });
      }
    };

    const onPointerUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      engine.events.emit('drag:shield', { active: false });

      if (sourceType === 'float') {
        const fp = engine.getFree(sourceId);
        if (fp) {
          fp.panel.ignoreHover = false;
          engine.events.emit('free:update', { count: engine.getAllFree().length });
        }
      }

      if (isDragging) {
        let finalPanelId: string | null = null;
        if (detectHover) {
          const selfEl = document.querySelector(`[data-node-id="${sourceId}"]`) as HTMLElement;
          const prev = selfEl?.style.display ?? '';
          if (selfEl) selfEl.style.display = 'none';

          const elemBelow = document.elementFromPoint(currentGlobalX, currentGlobalY);
          finalPanelId = elemBelow?.closest?.('[data-node-id]')?.getAttribute?.('data-node-id') || null;

          if (selfEl) selfEl.style.display = prev;
        }

        engine.events.emit('drag:end', {
          sourceId,
          sourceType,
          endX: currentGlobalX,
          endY: currentGlobalY,
          deltaX: currentGlobalX - startX,
          deltaY: currentGlobalY - startY,
          hoveredPanelId: finalPanelId,
        });
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  },
};