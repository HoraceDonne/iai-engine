<template>
  <div class="float-resize-overlay">
    <template v-for="fp in freePanels" :key="fp.id">
      <template v-if="isResizable(fp.panel)">
        <div
          v-if="config.cornerOnly"
          class="resize-handle corner-only"
          :style="getCornerStyle(fp)"
          @pointerdown.prevent.stop="startResize(fp, 'se', $event)"
        >
          <div class="corner-visual"></div>
        </div>
        <template v-else>
          <div
            v-for="handle in getHandles(fp)"
            :key="`${fp.id}-${handle.dir}`"
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
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useEngine } from '../../../renderers/vue/composables/useIai';
import { calculateSnappedResizeRect, type ResizeDirection } from '../core';
import type { FloatPlugin } from '../index';
import { DEFAULT_FLOAT_CONFIG } from '../config';

const engine = useEngine();

// 🌟 安全获取 FloatPlugin 实例，可能尚未安装或查找失败
let plugin: FloatPlugin | undefined;

try {
  plugin = engine.getPlugins().find(p => p.name === 'FloatPlugin') as FloatPlugin | undefined;
} catch (e) {
  console.warn('[FloatOverlay] 无法获取 FloatPlugin 实例', e);
}

// 🌟 使用插件配置的响应式副本，若插件不存在则回退到默认配置
const config = reactive(
  plugin ? { ...plugin.config } : { ...DEFAULT_FLOAT_CONFIG }
);

// 如果插件存在但后续才安装，可以监听插件变化？简单场景下不会发生，所以当前处理足够

// 同步悬浮窗列表
const freePanels = ref<any[]>([]);
const updateFreePanels = () => {
  freePanels.value = engine.getAllFree();
};

onMounted(() => {
  engine.events.on('free:update', updateFreePanels);
  updateFreePanels();
});

onUnmounted(() => {
  engine.events.off('free:update', updateFreePanels);
});

const isResizable = (panel: any) => {
  const props = engine.getPanelProps(panel);
  return props.resizable !== false;
};

const getHandles = (fp: any) => {
  const s = config.handleSize;
  const h = s / 2;
  const c = s * 2;
  const ch = c / 2;

  const baseStyle = { position: 'absolute' as const, boxSizing: 'border-box' as const };

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
  const s = config.handleSize * 2;
  return {
    position: 'absolute' as const,
    left: `${fp.x + fp.width - s}px`,
    top: `${fp.y + fp.height - s}px`,
    width: `${s}px`,
    height: `${s}px`,
    cursor: 'nwse-resize'
  };
};

const startResize = (fp: any, direction: ResizeDirection, e: PointerEvent) => {
  engine.focus(fp.id);
  const allFree = engine.getAllFree();
  const maxZ = allFree.reduce((max, f) => Math.max(max, f.zIndex), 0);
  engine.updateFree(fp.id, { zIndex: maxZ + 1 });

  const startRect = { x: fp.x, y: fp.y, width: fp.width, height: fp.height };
  const guides = fp.panel?.meta?.guides || {};
  const realProps = engine.getPanelProps(fp.panel);
  const panelMinSize = realProps.minSize ?? 40;

  const opPlugin = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as any;
  opPlugin?.exec('drag.start', { sourceId: fp.id, initialX: e.clientX, initialY: e.clientY, threshold: 2 });

  const onMove = (data: any) => {
    if (data.sourceId !== fp.id) return;

    const vp = engine.getViewport();
    const boundary = { x: 0, y: 0, width: vp.width || window.innerWidth, height: vp.height || window.innerHeight };

    const newRect = calculateSnappedResizeRect({
      startRect,
      boundary,
      guides,
      handle: direction,
      deltaX: data.deltaX,
      deltaY: data.deltaY,
      minSize: panelMinSize,
      enableSnap: config.enableSnap,
      snapThreshold: config.snapThreshold
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
  transition: background-color 0.15s ease-out;
  background-color: transparent;
}
.resize-handle:hover {
  background-color: rgba(0, 122, 204, 0.4);
}
.resize-handle.corner-only .corner-visual {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-bottom: 12px solid rgba(150, 150, 150, 0.6);
  transition: border-bottom-color 0.15s ease-out;
}
.resize-handle.corner-only:hover .corner-visual {
  border-bottom-color: rgba(0, 122, 204, 0.9);
}
</style>