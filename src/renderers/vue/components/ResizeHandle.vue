<template>
  <div
    v-if="visible"
    class="resize-handle"
    @pointerdown.prevent.stop="onPointerDown"
    title="拖拽调整大小"
  ></div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue';
import { useEngine } from '../composables/useIai';
import type { OperatorPlugin } from '../../../plugins/operator';
const props = defineProps<{ itemId: string; visible: boolean }>();
const engine = useEngine();
const operator = computed(() =>
  engine.getPlugins().find(p => p.name === 'OperatorPlugin') as OperatorPlugin
);

let cleanup: (() => void) | null = null;

const onPointerDown = (e: PointerEvent) => {
  const fp = engine.getFree(props.itemId);
  if (!fp) return;

  const startW = fp.width;
  const startH = fp.height;

  // 启动通用拖拽事件源
  operator.value?.exec('drag.start', {
    sourceId: props.itemId,
    initialX: e.clientX,
    initialY: e.clientY,
    threshold: 2,
  });

  // 监听拖拽移动，实时调整大小
  const onMove = (data: any) => {
    if (data.sourceId !== props.itemId) return;
    const newW = Math.max(40, startW + data.deltaX);
    const newH = Math.max(40, startH + data.deltaY);
    operator.value?.exec('float.resize', { id: props.itemId, width: newW, height: newH });
  };

  // 拖拽结束，执行四参考线约束
  const onEnd = () => {
    operator.value?.exec('float.clamp', { target: props.itemId });
    engine.events.off('drag:move', onMove);
    engine.events.off('drag:end', onEnd);
    cleanup = null;
  };

  engine.events.on('drag:move', onMove);
  engine.events.on('drag:end', onEnd);
  cleanup = () => {
    engine.events.off('drag:move', onMove);
    engine.events.off('drag:end', onEnd);
  };
};

onUnmounted(() => {
  cleanup?.();
});
</script>

<style scoped>
.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;      /* 给一个实际宽高，避免被 overflow:hidden 裁掉 */
  height: 16px;
  cursor: nwse-resize;
  z-index: 10;
  background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%);
}
.resize-handle:hover {
  background: linear-gradient(135deg, transparent 50%, rgba(0,122,204,0.8) 50%);
}
</style>