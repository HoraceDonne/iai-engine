<template>
  <div 
    class="interactive-split-overlay" 
    v-show="splitState.isActive"
    :style="{ cursor: config.cursor }"
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
  return plugin?.config || ({} as any);
});

const lineStyle = computed(() => {
  const c = config.value;
  const baseStyle = {
    backgroundColor: splitState.isSnapped ? c.snapColor : c.lineColor,
    boxShadow: `0 0 6px ${splitState.isSnapped ? c.snapColor : c.lineColor}`,
  };

  if (splitState.direction === 'horizontal') {
    return {
      ...baseStyle,
      left: `${splitState.x - c.lineWidth / 2}px`,
      top: `${splitState.y}px`,
      width: `${c.lineWidth}px`,
      height: `${splitState.length}px`,
    };
  } else {
    return {
      ...baseStyle,
      left: `${splitState.x}px`,
      top: `${splitState.y - c.lineWidth / 2}px`,
      width: `${splitState.length}px`,
      height: `${c.lineWidth}px`,
    };
  }
});
</script>

<style scoped>
.interactive-split-overlay {
  position: absolute;
  inset: 0;
  z-index: 15000;
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