<template>
  <div ref="containerRef" class="iai-layout-container" :class="{ 'is-dragging': shieldActive }">
    <div class="iai-panel-layer">
      <IaiFlatNode
        v-for="item in renderItems"
        :key="item.id"
        :item="item"
        :component="engine.getComp(item.node.panelType)"
        @focus="engine.focus(item.id)"
      />
    </div>
    <div class="iai-plugin-overlay-layer">
      <slot name="overlay" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from 'vue';
import type { IaiEngine } from '../../../core/IaiEngine';
import { ENGINE_KEY } from '../composables/useIai';
import IaiFlatNode from './IaiFlatNode.vue';
const props = defineProps<{ engine: IaiEngine }>();
const containerRef = ref<HTMLElement | null>(null);
const viewport = ref({ width: 0, height: 0 });
const shieldActive = ref(false);
provide(ENGINE_KEY, props.engine);

const renderItems = computed(() =>
  props.engine.getRenderItems(viewport.value.width, viewport.value.height)
);

const updateViewport = () => {
  if (containerRef.value) {
    // 🌟 与 DominoOverlay.vue 严丝合缝对齐底层小数精度，消灭因精度产生的偏移缝隙
    const rect = containerRef.value.getBoundingClientRect();
    viewport.value = {
      width: rect.width,
      height: rect.height,
    };

     props.engine.setViewport(rect.width, rect.height);
  }
};

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver(updateViewport);
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  updateViewport();

  props.engine.events.on('tree:update', updateViewport);
  props.engine.events.on('free:update', updateViewport);
  props.engine.events.on('drag:shield', (payload: any) => {
  shieldActive.value = payload.active;
  if (payload.active) {
    document.body.style.cursor = payload.cursor || 'grabbing';
    document.body.style.userSelect = 'none';
  } else {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  props.engine.events.off('tree:update', updateViewport);
  props.engine.events.off('free:update', updateViewport);
  props.engine.events.off('drag:shield' as any, () => {});
});
</script>

<style scoped>
.iai-layout-container { position: relative; width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
.iai-panel-layer { position: absolute; inset: 0; pointer-events: auto; }
.iai-plugin-overlay-layer { position: absolute; inset: 0; pointer-events: none; }

.iai-layout-container.is-dragging {
  user-select: none !important;
  -webkit-user-drag: none !important;
}
</style>