<template>
  <div class="float-resize-overlay">
    <template v-for="fp in freePanels" :key="fp.id">
      <!-- 只为当前聚焦的悬浮窗渲染把手 -->
      <template v-if="fp.id === activeFloatId && isResizable(fp.panel)">
        <!-- 仅右下角三角形模式 -->
        <div
          v-if="config.cornerOnly"
          class="resize-handle corner-only"
          :style="getCornerStyle(fp)"
          @pointerdown.prevent.stop="startResize(fp, 'se', $event)"
        />
        <!-- 八向把手模式 -->
        <template v-else>
          <div
            v-for="handle in getHandles(fp)"
            :key="handle.dir"
            class="resize-handle"
            :class="`handle-${handle.dir}`"
            :style="handle.style"
            @pointerdown.prevent.stop="startResize(fp, handle.dir, $event)"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useEngine } from '../../../renderers/vue/composables/useIai';
import { computeResizeRect, type ResizeDirection } from '../core';
import { clampResize } from '../../../core/constraint';
import type { FloatResizePlugin } from '../index';

const engine = useEngine();
const plugin = engine.getPlugins().find(p => p.name === 'FloatResizePlugin') as FloatResizePlugin;
const config = computed(() => plugin.config);
const getPanelProps = (panel: any) => engine.getPanelProps(panel);

// 🌟 核心修复：用事件驱动的 ref 替代 computed，确保响应式更新
const freePanels = ref<any[]>([]);
const updateFreePanels = () => {
  freePanels.value = engine.getAllFree();
};

const activeFloatId = ref<string | null>(null);
const updateActiveFloat = () => {
  const focused = engine.getFocus();
  if (focused && engine.getFree(focused)) {
    // 🌟 自动置顶：将聚焦的悬浮窗 zIndex 设为最大
    const allFree = engine.getAllFree();
    const maxZ = allFree.reduce((max, f) => Math.max(max, f.zIndex), 0);
    engine.updateFree(focused, { zIndex: maxZ + 1 });

    activeFloatId.value = focused;
  } else {
    activeFloatId.value = null;
  }
};

onMounted(() => {
  engine.events.on('free:update' as any, updateFreePanels);
  engine.events.on('focus:change' as any, updateActiveFloat);
  updateFreePanels();
  updateActiveFloat();
});

onUnmounted(() => {
  engine.events.off('free:update' as any, updateFreePanels);
  engine.events.off('focus:change' as any, updateActiveFloat);
});

const isResizable = (panel: any) => {
  const props = getPanelProps(panel);
  return props.resizable !== false;
};

const getHandles = (fp: any) => {
  const s = 16;
  const h = s / 2;
  const c = s * 1.5;
  const ch = c / 2;

  const baseStyle = {
    position: 'absolute' as const,
    background: config.value.handleColor,
    boxSizing: 'border-box' as const,
    zIndex: 100,
  };

  return [
    { dir: 'n' as ResizeDirection, style: { ...baseStyle, left: `${fp.x}px`, top: `${fp.y - h}px`, width: `${fp.width}px`, height: `${s}px`, cursor: 'ns-resize' } },
    { dir: 's' as ResizeDirection, style: { ...baseStyle, left: `${fp.x}px`, top: `${fp.y + fp.height - h}px`, width: `${fp.width}px`, height: `${s}px`, cursor: 'ns-resize' } },
    { dir: 'e' as ResizeDirection, style: { ...baseStyle, left: `${fp.x + fp.width - h}px`, top: `${fp.y}px`, width: `${s}px`, height: `${fp.height}px`, cursor: 'ew-resize' } },
    { dir: 'w' as ResizeDirection, style: { ...baseStyle, left: `${fp.x - h}px`, top: `${fp.y}px`, width: `${s}px`, height: `${fp.height}px`, cursor: 'ew-resize' } },
    { dir: 'nw' as ResizeDirection, style: { ...baseStyle, left: `${fp.x - ch}px`, top: `${fp.y - ch}px`, width: `${c}px`, height: `${c}px`, cursor: 'nwse-resize' } },
    { dir: 'ne' as ResizeDirection, style: { ...baseStyle, left: `${fp.x + fp.width - ch}px`, top: `${fp.y - ch}px`, width: `${c}px`, height: `${c}px`, cursor: 'nesw-resize' } },
    { dir: 'sw' as ResizeDirection, style: { ...baseStyle, left: `${fp.x - ch}px`, top: `${fp.y + fp.height - ch}px`, width: `${c}px`, height: `${c}px`, cursor: 'nesw-resize' } },
    { dir: 'se' as ResizeDirection, style: { ...baseStyle, left: `${fp.x + fp.width - ch}px`, top: `${fp.y + fp.height - ch}px`, width: `${c}px`, height: `${c}px`, cursor: 'nwse-resize' } },
  ];
};

const getCornerStyle = (fp: any) => {
  return {
    position: 'absolute' as const,
    left: `${fp.x + fp.width}px`,
    top: `${fp.y + fp.height}px`,
    width: '0',
    height: '0',
    borderLeft: '12px solid transparent',
    borderTop: `12px solid ${config.value.handleColor}`,
    cursor: 'nwse-resize',
    zIndex: 10,
  };
};

const startResize = (fp: any, direction: ResizeDirection, e: PointerEvent) => {
  const startRect = { x: fp.x, y: fp.y, width: fp.width, height: fp.height };
  const opPlugin = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as any;
  const guides = fp.panel?.meta?.guides || { top: 0, bottom: 0, left: 0, right: 0 };

  opPlugin?.exec('drag.start', { sourceId: fp.id, initialX: e.clientX, initialY: e.clientY, threshold: 2 });

  const onMove = (data: any) => {
    if (data.sourceId !== fp.id) return;

    const vp = engine.getViewport();
    const boundary = {
      x: 0, y: 0,
      width: vp.width || window.innerWidth,
      height: vp.height || window.innerHeight,
    };

    const newRect = clampResize({
      startRect,
      boundary,
      offsets: guides,
      handle: direction,
      deltaX: data.deltaX,
      deltaY: data.deltaY,
      minWidth: config.value.minSize,
      minHeight: config.value.minSize,
    });

    engine.updateFree(fp.id, newRect);
  };

  const onEnd = () => {
    engine.events.off('drag:move', onMove);
    engine.events.off('drag:end', onEnd);
  };

  engine.events.on('drag:move', onMove);
  engine.events.on('drag:end', onEnd);
};
</script>

<style scoped>
.float-resize-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10002;
}
.resize-handle {
  pointer-events: auto;
}
</style>