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
      :style="{ left: line.position + 'px', top: line.crossStart + 'px', height: (line.crossEnd - line.crossStart) + 'px' }"
      @pointerdown.prevent="startDrag(line.id, 'vertical', $event)"
    ></div>

    <div
      v-for="line in gridLines.hLines"
      v-show="line.resizable"
      :key="'dh-' + line.id"
      class="drag-handle horizontal"
      :class="{ 'is-active': activeSplitId === line.id }"
      :style="{ top: line.position + 'px', left: line.crossStart + 'px', width: (line.crossEnd - line.crossStart) + 'px' }"
      @pointerdown.prevent="startDrag(line.id, 'horizontal', $event)"
    ></div>

    <div class="mode-switcher" @pointerdown.stop>
      <label><input type="radio" v-model="dragMode" value="domino" /> 多米诺推挤</label>
      <label><input type="radio" v-model="dragMode" value="simple" /> 基础卡位</label>
    </div>
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
  type DragMode,
  type DragContext,
} from '../core';
import type { DominoPlugin } from '../index';

const engine = useEngine();
const containerRef = ref<HTMLElement | null>(null);
const viewport = ref({ width: 0, height: 0 });

const isDragging = ref(false);
const dragMode = ref<DragMode>('domino');
const activeSplitId = ref<string | null>(null);
const activeDirection = ref<'horizontal' | 'vertical' | null>(null);

const dominoPlugin = engine.getPlugins().find(p => p.name === 'DominoPlugin') as DominoPlugin;
const opPlugin = computed(() => engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any);

const gridLines = ref<{
  vLines: Array<{
    id: string;
    position: number;
    crossStart: number;
    crossEnd: number;
    resizable: boolean;
  }>;
  hLines: Array<{
    id: string;
    position: number;
    crossStart: number;
    crossEnd: number;
    resizable: boolean;
  }>;
}>({ vLines: [], hLines: [] });

const updateOverlay = () => {
  if (!containerRef.value || !engine.getRoot()) return;
  const rect = containerRef.value.getBoundingClientRect();
  viewport.value = { width: rect.width, height: rect.height };
  const geoMap = engine.getGeoMap(rect.width, rect.height);
  const rawGrid = engine.getGridLines(geoMap);

  const root = engine.getRoot();
  const findNode = (id: string): any => {
    if (!root) return null;
    const dfs = (node: any): any => {
      if (node.id === id) return node;
      if (node.children) return dfs(node.children[0]) || dfs(node.children[1]);
      return null;
    };
    return dfs(root) || { resizable: true };
  };

  gridLines.value = {
    vLines: rawGrid.vLines.map(line => ({
      ...line,
      resizable: findNode(line.id)?.resizable !== false,
    })),
    hLines: rawGrid.hLines.map(line => ({
      ...line,
      resizable: findNode(line.id)?.resizable !== false,
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

  // 🌟 唯一修改：传入 getPanelProps
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
      // 🌟 唯一修改：传入 getPanelProps
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
      const result = simulatePush(activeCtx, intendedDelta);
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
      // 🌟 唯一修改：获取真实属性
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
  background-color: transparent;
  transition: background-color 0.1s ease;
}
.drag-handle.vertical { width: 9px; margin-left: -4.5px; cursor: col-resize; }
.drag-handle.horizontal { height: 9px; margin-top: -4.5px; cursor: row-resize; }
.drag-handle:hover, .drag-handle.is-active { background-color: rgba(0, 127, 212, 0.25); }
.domino-overlay:has(.drag-shield) .drag-handle:not(.is-active) { pointer-events: none; }
.mode-switcher {
  position: absolute; bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8); color: #fff;
  padding: 10px; border-radius: 6px; border: 1px solid #444;
  display: flex;
  gap: 10px; font-size: 12px; pointer-events: auto; z-index: 10000;
}
.mode-switcher label { cursor: pointer; display: flex; align-items: center; gap: 4px; }
</style>