<template>
  <div ref="containerRef" class="iai-layout-container">
    <!-- 面板渲染层 -->
    <div class="iai-panel-layer">
      <IaiFlatNode
        v-for="item in renderItems"
        :key="item.id"
        :item="item"
        :component="engine.getComp(item.node.panelType)"
        @focus="engine.focus(item.id)"
      />
    </div>

    <!-- 插件覆盖层（自动渲染有 UI 的插件） -->
    <div class="iai-plugin-overlay-layer">
      <component
        v-for="p in overlayPlugins"
        :key="p.name"
        :is="(p as any).overlayComponent"
      />
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

provide(ENGINE_KEY, props.engine);

// 面板类型列表（自动从引擎获取，响应式）
const panelTypes = computed(() => props.engine.getRegisteredTypes());
provide('PANEL_TYPES', panelTypes);

// 插件覆盖层（自动渲染有 UI 的插件）
const overlayPlugins = computed(() =>
  props.engine.getPlugins().filter((p: any) => (p as any).overlayComponent)
);

// 渲染项计算
const renderItems = computed(() =>
  props.engine.getRenderItems(viewport.value.width, viewport.value.height)
);

// 视口更新
const updateViewport = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    viewport.value = { width: rect.width, height: rect.height };
    props.engine.setViewport(rect.width, rect.height);
  }
};

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  resizeObserver = new ResizeObserver(updateViewport);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  updateViewport();
  props.engine.events.on('tree:update', updateViewport);
  props.engine.events.on('free:update', updateViewport);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  props.engine.events.off('tree:update', updateViewport);
  props.engine.events.off('free:update', updateViewport);
});
</script>

<style scoped>
.iai-layout-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1e1e1e;
}
.iai-panel-layer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
.iai-plugin-overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>