<template>
  <div class="docking-highlight-overlay">
    <div
      v-if="dockingState.rect"
      class="docking-highlight"
      :class="dockingState.zone ? `zone-${dockingState.zone}` : ''"
      :style="highlightStyle"
    >
      <div class="visual"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { dockingState } from '../state';

// 🌟 核心改进：视图层变得极度纯粹。不再有 width /= 2 的判断。
// 操作符传过来精确到像素的 x, y, width, height，这里直接渲染。
const highlightStyle = computed(() => {
  const rect = dockingState.rect;
  if (!rect) return { display: 'none' as const };

  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
});
</script>

<style scoped>
.docking-highlight-overlay {
  position: absolute; inset: 0;
  pointer-events: none; z-index: 10001;
}
.docking-highlight {
  position: absolute; transition: all 0.1s ease-out; box-sizing: border-box; padding: 3px;
}
.visual {
  width: 100%; height: 100%;
  background-color: rgba(0, 127, 212, 0.35);
  border: 2px solid #007fd4;
  border-radius: 4px;
}
.zone-center .visual {
  background-color: rgba(148, 0, 211, 0.25);
  border-color: #9400d3;
}
</style>