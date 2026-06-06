<template>
  <div ref="containerRef" class="domino-overlay" :style="{ zIndex: dominoZIndex }">
    <div
      v-if="isDragging"
      class="drag-shield"
      :style="{ cursor: activeDirection === 'vertical' ? 'col-resize' : 'row-resize' }"
    ></div>

    <div
      v-for="line in gridLines.vLines"
      v-show="line.resizable"
      :key="'dv-' + line.id"
      class="drag-handle vertical"
      :class="{ 'is-active': activeSplitId === line.id }"
      :data-grid-index="line.index" 
      :data-first="line.isFirst || undefined"
      :data-last="line.isLast || undefined"
      :style="getHandleStyle(line, 'vertical')"
      @pointerdown.prevent="startDrag(line.id, 'vertical', $event)"
    />

    <div
      v-for="line in gridLines.hLines"
      v-show="line.resizable"
      :key="'dh-' + line.id"
      class="drag-handle horizontal"
      :class="{ 'is-active': activeSplitId === line.id }"
      :data-grid-index="line.index"
      :data-first="line.isFirst || undefined"
      :data-last="line.isLast || undefined"
      :style="getHandleStyle(line, 'horizontal')"
      @pointerdown.prevent="startDrag(line.id, 'horizontal', $event)"
    />
    
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useEngine } from '../../../renderers/vue/composables/useIai';
import {
  createDragContext,
  simulatePush,
  rebuildTreeRatios,
  unlockAndSyncRatios,
  type DragContext,
  type DragMode
} from '../core';
import type { DominoPlugin } from '../index';

const engine = useEngine();
const containerRef = ref<HTMLElement | null>(null);
const viewport = ref({ width: 0, height: 0 });

const isDragging = ref(false);
const dragMode = computed(() => dominoPlugin.config.mode || 'domino');
const activeSplitId = ref<string | null>(null);
const activeDirection = ref<'horizontal' | 'vertical' | null>(null);

const dominoPlugin = engine.getPlugins().find(p => p.name === 'DominoPlugin') as DominoPlugin;

const gridLines = ref<{
  vLines: Array<{
    id: string;
    position: number;
    crossStart: number;
    crossEnd: number;
    resizable: boolean;
    index: number;
    isFirst: boolean;
    isLast: boolean; 
  }>;
  hLines: Array<{
    id: string;
    position: number;
    crossStart: number;
    crossEnd: number;
    resizable: boolean;
    index: number;
    isFirst: boolean;
    isLast: boolean; 
  }>;
}>({ vLines: [], hLines: [] });

const updateOverlay = () => {
  if (!containerRef.value || !engine.getRoot()) return;
  const rect = containerRef.value.getBoundingClientRect();
  viewport.value = { width: rect.width, height: rect.height };
  const geoMap = engine.getGeoMap(rect.width, rect.height);
  const rawGrid = engine.getGridLines(geoMap);

  const root = engine.getRoot();
  
  // 🌟 修正 1：一次性遍历树，构建 resizable 映射表，彻底干掉 O(N^2) 的嵌套 DFS 循环
  const resizableMap = new Map<string, boolean>();
  const traverse = (node: any) => {
    if (!node) return;
    resizableMap.set(node.id, node.resizable !== false);
    if (node.children) {
      traverse(node.children[0]);
      traverse(node.children[1]);
    }
  };
  traverse(root);

  // 🌟 修正 2：强制按绝对物理坐标排序，保证 index 永远匹配视觉顺序！
  const sortedVLines = [...rawGrid.vLines].sort((a, b) => a.position - b.position);
  const sortedHLines = [...rawGrid.hLines].sort((a, b) => a.position - b.position);

  const vLen = sortedVLines.length;
  const hLen = sortedHLines.length;

  gridLines.value = {
    vLines: sortedVLines.map((line, index) => ({
      ...line,
      resizable: resizableMap.has(line.id) ? resizableMap.get(line.id)! : true,
      index, // 现在的 index 是绝对准确的视觉索引
      isFirst: index === 0,
      isLast: index === vLen - 1,
    })),
    hLines: sortedHLines.map((line, index) => ({
      ...line,
      resizable: resizableMap.has(line.id) ? resizableMap.get(line.id)! : true,
      index,
      isFirst: index === 0,
      isLast: index === hLen - 1,
    })),
  };
};

const dominoZIndex = computed(() => dominoPlugin.config.zIndexBase);

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(updateOverlay);
    resizeObserver.observe(containerRef.value);
  }
  engine.events.on('tree:update', updateOverlay);
  updateOverlay();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  engine.events.off('tree:update', updateOverlay);
});

let activeCtx: DragContext | null = null;
let rafId: number | null = null;
let startX = 0, startY = 0;
let lastFrameTime = 0;
let lastProcessedDelta = 0;

const startDrag = (splitId: string, direction: 'horizontal' | 'vertical', e: PointerEvent) => {
  const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
  if (elemBelow?.closest?.('.iai-flat-node.is-floating')) {
    return; 
  }

  const rootTree = engine.getRoot();
  if (!rootTree || !containerRef.value) return;

  const geoMap = engine.getGeoMap(viewport.value.width, viewport.value.height);
  
  const pureGrid = {
    vLines: gridLines.value.vLines.map(({ resizable, ...rest }) => rest),
    hLines: gridLines.value.hLines.map(({ resizable, ...rest }) => rest),
  };

  activeCtx = createDragContext(
    rootTree, splitId, viewport.value, geoMap, pureGrid, dominoPlugin.config, dragMode.value,
    (node: any) => engine.getPanelProps(node)
  );
  if (!activeCtx) return;

  if (dominoPlugin.config.rigidClamp) {
    const affectedIds = new Set<string>();
    for (const panel of activeCtx.leafPanels) {
      if (
        panel.leftLineId === splitId ||
        panel.rightLineId === splitId ||
        panel.topLineId === splitId ||
        panel.bottomLineId === splitId
      ) {
        affectedIds.add(panel.id);
      }
    }

    let needsUnlock = false;
    for (const id of affectedIds) {
      const node = engine.getNode(id);
      if (node && (node as any).isFixed) {
        needsUnlock = true;
        break;
      }
    }

    if (needsUnlock) {
      const newTree = unlockAndSyncRatios(rootTree, affectedIds, geoMap);
      engine.mount(newTree, true);
      const updatedGeoMap = engine.getGeoMap(viewport.value.width, viewport.value.height);
      activeCtx = createDragContext(
        newTree, splitId, viewport.value, updatedGeoMap, pureGrid, dominoPlugin.config, dragMode.value,
        (node: any) => engine.getPanelProps(node)
      );
      if (!activeCtx) return;
    }
  }

  isDragging.value = true;
  activeSplitId.value = splitId;
  activeDirection.value = direction;

  const rect = containerRef.value.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;

  lastFrameTime = performance.now();
  lastProcessedDelta = 0;

  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
};

const onDragMove = (e: PointerEvent) => {
  if (!activeCtx || !isDragging.value || !containerRef.value) return;
  e.preventDefault();
  
  const now = performance.now();
  if (now - lastFrameTime < 1000 / dominoPlugin.config.fpsLimit) return;

  const rect = containerRef.value.getBoundingClientRect();
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;

  const clampedX = Math.max(0, Math.min(localX, viewport.value.width));
  const clampedY = Math.max(0, Math.min(localY, viewport.value.height));

  const intendedDelta = activeCtx.direction === 'horizontal' ? clampedX - startX : clampedY - startY;
  
  if (Math.abs(intendedDelta - lastProcessedDelta) < dominoPlugin.config.deadzone) return;

  lastFrameTime = now;
  lastProcessedDelta = intendedDelta;

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      if (!activeCtx) return;

    let result;

    if (dominoPlugin.config.mode === 'magnetic') {
      const snapCtx = { ...activeCtx, mode: 'simple' as DragMode };
      result = simulatePush(snapCtx, intendedDelta);

      const dir = activeCtx.direction;
      const linePos = result.positions.get(activeCtx.splitId);
      if (linePos !== undefined) {
        for (const panel of activeCtx.leafPanels) {
          let isLeftOrTop = false;
          let otherLineId: string | null = null;

          if (dir === 'horizontal' && panel.leftLineId === activeCtx.splitId) {
            isLeftOrTop = true; otherLineId = panel.rightLineId;
          } else if (dir === 'horizontal' && panel.rightLineId === activeCtx.splitId) {
            isLeftOrTop = false; otherLineId = panel.leftLineId;
          } else if (dir === 'vertical' && panel.topLineId === activeCtx.splitId) {
            isLeftOrTop = true; otherLineId = panel.bottomLineId;
          } else if (dir === 'vertical' && panel.bottomLineId === activeCtx.splitId) {
            isLeftOrTop = false; otherLineId = panel.topLineId;
          } else {
            continue;
          }

          const node = engine.getNode(panel.id);
          const props = node ? engine.getPanelProps(node) : null;
          const threshold = props?.meta?.snapThreshold ?? 0;
          const otherPos = otherLineId
            ? result.positions.get(otherLineId)
            : (isLeftOrTop ? activeCtx.viewportWidth : 0);
          if (otherPos === undefined) continue;

          const currentSize = isLeftOrTop ? otherPos - linePos : linePos - otherPos;
          if (Math.abs(currentSize - panel.minSize) < threshold) {
            const correctedPos = isLeftOrTop ? otherPos - panel.minSize : otherPos + panel.minSize;
            result.positions.set(activeCtx.splitId, correctedPos);
            break;
          }
        }
      }
    } else {
      result = simulatePush(activeCtx, intendedDelta);
    }

      const rootRect = { x: 0, y: 0, width: activeCtx.viewportWidth, height: activeCtx.viewportHeight };
      const newTree = rebuildTreeRatios(engine.getRoot()!, rootRect, result.positions, activeCtx);
      engine.mount(newTree, true);
      rafId = null;
    });
  }
};

const onDragEnd = () => {
  if (dominoPlugin.config.rigidClamp && activeCtx) {
    const allNodes = engine.getAllNodes();
    const geoMap = engine.getGeoMap(viewport.value.width, viewport.value.height);
    const currentDirection = activeCtx.direction;

    for (const node of allNodes) {
      const rect = geoMap.get(node.id);
      const realProps = engine.getPanelProps(node);
      if (rect && realProps.minSize !== undefined) {
        const actualSize = currentDirection === 'horizontal' ? rect.width : rect.height;
        const isAtMin = Math.abs(actualSize - realProps.minSize) < 1;
        if (isAtMin && !node.isFixed) {
          engine.replace(node.id, {
            ...node,
            isFixed: true,
            fixedSize: realProps.minSize,
          });
        }
      }
    }
  }

  isDragging.value = false;
  activeSplitId.value = null;
  activeDirection.value = null;
  activeCtx = null;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

const getHandleStyle = (line: any, dir: 'vertical' | 'horizontal') => {
  if (dir === 'vertical') {
    return {
      left: `${line.position}px`,
      top: `${line.crossStart}px`,
      height: `${line.crossEnd - line.crossStart}px`,
    };
  } else {
    return {
      top: `${line.position}px`,
      left: `${line.crossStart}px`,
      width: `${line.crossEnd - line.crossStart}px`,
    };
  }
};

</script>

<style scoped>
.domino-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.drag-shield {
  position: absolute;
  inset: 0;
  z-index: 9998;
  pointer-events: auto;
}
.drag-handle {
  position: absolute;
  pointer-events: auto;
  z-index: 100;
  transition: background-color 0.15s ease;
}
/* 默认好看的样式 */
.drag-handle {
  background-color: transparent;
}
.drag-handle:hover {
  background-color: rgba(0, 127, 212, 0.15);
}
.drag-handle.is-active {
  background-color: rgba(0, 127, 212, 0.35) !important;
}
/* 垂直线 */
.drag-handle.vertical {
  width: 7px;
  margin-left: -3.5px;
  cursor: col-resize;
}
/* 水平线 */
.drag-handle.horizontal {
  height: 7px;
  margin-top: -3.5px;
  cursor: row-resize;
}
.domino-overlay:has(.drag-shield) .drag-handle:not(.is-active) {
  pointer-events: none;
}
</style>