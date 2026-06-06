<template>
  <div
    class="iai-flat-node"
    :class="item.customClass"
    :style="cssVars"
    :data-node-id="item.id"
    @pointerdown.capture="onFocus"
    @pointerenter="onHover"
    @pointerleave="onLeave"
  >
    <component
      :is="component"
      v-if="component"
      :shared="sharedContainer"
      :private="privateContainer"
      :node-id="item.id"
      :instance-id="item.node.instanceId"
      :is-master="item.node.isMaster !== false"
    />
    <div v-else class="iai-missing">[面板未注册]</div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, reactive } from 'vue';
import type { RenderItem } from '../../../core/types';
import { ENGINE_KEY, useEngine } from '../composables/useIai';
const props = defineProps<{ item: RenderItem; component: any }>();
const emit = defineEmits<{ (e: 'focus', id: string): void }>();

const engine = useEngine();          // 获取父级注入的引擎实例
provide(ENGINE_KEY, engine);        // 继续向下注入，保持上下文

const sharedCache = new Map<string, Record<string, any>>();

const sharedContainer = computed(() => {
  const panelType = props.item.node.panelType;
  if (!sharedCache.has(panelType)) {
    const raw = engine.getSharedContainer(panelType);
    sharedCache.set(panelType, reactive(raw));
  }
  return sharedCache.get(panelType)!;
});

const onFocus = () => emit('focus', props.item.id);
const onHover = () => engine.setHover(props.item.id);
const onLeave = () => {
  if (engine.getHover() === props.item.id) {
    engine.setHover(null);
  }
};

const cssVars = computed(() => {
  const { rect, zIndex } = props.item;
  return {
    '--node-x': `${Math.round(rect.x)}px`,
    '--node-y': `${Math.round(rect.y)}px`,
    '--node-w': `${Math.round(rect.width)}px`,
    '--node-h': `${Math.round(rect.height)}px`,
    '--node-z': zIndex,
  };
});

// 使用一个 Map 缓存已包装的响应式私有容器
const privateCache = new Map<string, Record<string, any>>();

const privateContainer = computed(() => {
  const panelId = props.item.node.id;
  if (!privateCache.has(panelId)) {
    const raw = engine.getPrivateContainer(panelId);
    privateCache.set(panelId, reactive(raw));
  }
  return privateCache.get(panelId)!;
});

</script>

<style scoped>
.iai-flat-node {
  position: absolute;
  left: 0;
  top: 0;
  width: var(--node-w);
  height: var(--node-h);
  z-index: var(--node-z);
  transform: translate3d(var(--node-x), var(--node-y), 0);
  will-change: transform;
  overflow: hidden;
  box-sizing: border-box;
  border-right: 1px solid #333;
  border-bottom: 1px solid #333;
}
.iai-flat-node.is-floating {
  border: 2px solid #4fc1ff;
  border-radius: 6px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.iai-missing {
  color: #ff5f56;
  padding: 10px;
}

</style>