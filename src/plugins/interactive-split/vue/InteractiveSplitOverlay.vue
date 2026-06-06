<template>
  <div
    class="interactive-split-overlay"
    v-show="splitState.isActive"
  >
    <div class="split-capture-layer"></div>
    <div
      v-if="splitState.isHovering"
      class="split-preview-line"
      :style="lineStyle"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEngine } from '../../../renderers/vue/composables/useIai';
import { splitState } from '../state';
import type { InteractiveSplitPlugin } from '../index';

const engine = useEngine();

const config = computed(() => {
  const plugin = engine.getPlugins().find(p => p.name === 'InteractiveSplitPlugin') as InteractiveSplitPlugin;
  return plugin?.config || {};
});

// 默认视觉样式（不再从配置读取，改为固定值，方便全局 CSS 覆盖）
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_LINE_COLOR = '#007fd4';
const DEFAULT_SNAP_COLOR = '#00ff88';

const lineStyle = computed(() => {
  const c = config.value;
  const isSnapped = splitState.isSnapped;
  const color = isSnapped ? DEFAULT_SNAP_COLOR : DEFAULT_LINE_COLOR;
  const lineWidth = DEFAULT_LINE_WIDTH;

  const baseStyle: Record<string, string> = {
    backgroundColor: color,
    boxShadow: `0 0 6px ${color}`,
  };

  if (splitState.direction === 'horizontal') {
    return {
      ...baseStyle,
      left: `${splitState.x - lineWidth / 2}px`,
      top: `${splitState.y}px`,
      width: `${lineWidth}px`,
      height: `${splitState.length}px`,
    };
  } else {
    return {
      ...baseStyle,
      left: `${splitState.x}px`,
      top: `${splitState.y - lineWidth / 2}px`,
      width: `${splitState.length}px`,
      height: `${lineWidth}px`,
    };
  }
});
</script>

<style>
.interactive-split-overlay {
  position: absolute;
  inset: 0;
  z-index: 15000;
  cursor: crosshair; /* 固定十字准星，不再从配置读取 */
}
.split-capture-layer {
  width: 100%;
  height: 100%;
  background: transparent;
}
.split-preview-line {
  position: absolute;
  pointer-events: none;
  transition: background-color 0.1s, box-shadow 0.1s;
  border-radius: 2px;
}
</style>