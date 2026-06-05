<template>
  <div class="dev-header" @pointerdown="engine.focus(nodeId)">
    <div class="left">
      <span class="badge">{{ isMaster ? '👑本体' : '👤影子' }}</span>
      <select class="type-switch" :value="panelType" @change="onSwitch" @pointerdown.stop>
        <option v-for="t in panelTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <span class="inst-id" :title="'ID: ' + nodeId + '\n实例: ' + (instanceId || '无')">
      {{ nodeId }}
      <button class="copy-btn" @click.stop="copyId" title="复制ID">📋</button>
      </span>
      <button @pointerdown="operator.exec('docking.panel', { sourceId: nodeId, initialX: $event.clientX, initialY: $event.clientY })" title="面板停靠">⧉</button>
      <button @pointerdown="operator.exec('docking.global', { sourceId: nodeId, initialX: $event.clientX, initialY: $event.clientY })" title="全局插入">⊞</button>
    </div>
    <div class="actions" @pointerdown.stop>
      <button class="btn-tool" title="左右切 (产生垂直刀口)" @click="startInteractiveSplit('horizontal')"><span class="btn-icon">◧</span> 左右切</button>
      <button class="btn-tool" title="上下切 (产生水平刀口)" @click="startInteractiveSplit('vertical')"><span class="btn-icon">⬒</span> 上下切</button>
      <button
  @click="operator.exec('panel.float', { sourceId: nodeId, mode: 'singleton', keepSource: true })"
  title="撕扯为影子(保留)"
>🗗</button>
      <button
  @click="operator.exec('panel.float', { sourceId: nodeId, mode: 'multi', keepSource: false })"
  title="撕扯为本体(不保留)"
>⇱</button>
      <button @pointerdown.prevent="startDrag($event)"title="拖拽 (移动/停靠)">✥</button>
      <button @click="operator.exec('panel.close', { id: nodeId })" class="danger">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useEngine } from '../../renderers/vue/composables/useIai';
import type { OperatorPlugin } from '../../plugins/operator';

const props = defineProps<{ nodeId: string }>();

const engine = useEngine();
const operator = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as OperatorPlugin;
const panelTypes = inject<string[]>('PANEL_TYPES', []);

const panelType = computed(() => engine.getAny(props.nodeId)?.panelType ?? '');
const isMaster = computed(() => {
  const entity = engine.getAny(props.nodeId);
  return entity?.isMaster !== false;
});
const instanceId = computed(() => {
  const entity = engine.getAny(props.nodeId);
  return entity?.instanceId ?? null;
});

const onSwitch = (e: Event) => {
  const newType = (e.target as HTMLSelectElement).value;
  if (!newType || newType === panelType.value) return;
  operator.exec('panel.switch', { targetId: props.nodeId, newType });
};

// 🌟 拖拽触发：获取初始坐标并调用操作符
const startDrag = (e: PointerEvent) => {
  const fp = engine.getFree(props.nodeId);
  const startX = fp?.x ?? 0;
  const startY = fp?.y ?? 0;

  operator.exec('drag.start', {
    sourceId: props.nodeId,
    initialX: e.clientX,
    initialY: e.clientY,
    threshold: 5,
  });

  const onMove = (data: any) => {
    if (data.sourceId !== props.nodeId) return;
    operator.exec('float.move', {
      id: props.nodeId,
      x: startX + data.deltaX,
      y: startY + data.deltaY,
    });
    operator.exec('float.clamp', { target: props.nodeId });
  };

  const onEnd = () => {
    operator.exec('float.clamp', { target: props.nodeId });
    engine.events.off('drag:move', onMove);
    engine.events.off('drag:end', onEnd);
  };

  engine.events.on('drag:move', onMove);
  engine.events.on('drag:end', onEnd);
};

const copyId = async () => {
  try {
    await navigator.clipboard.writeText(props.nodeId);
    console.log('已复制 ID:', props.nodeId);
  } catch (err) {
    // 降级方案：使用旧 API
    const textarea = document.createElement('textarea');
    textarea.value = props.nodeId;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    console.log('已复制 ID (降级):', props.nodeId);
  }

};

// 🌟 触发交互式切割
const startInteractiveSplit = (mode: 'horizontal' | 'vertical') => {
  const operator = (window as any).operator;
  if (!operator) return;

  operator.exec('interactive.split.start', { 
    mode,
    sourceId: props.nodeId,    // 🌟 必须传！告诉操作符“只准在这个面板里切”
    cancelKey: 'Escape',       // 🌟 键盘取消键：按 Esc 取消
    cancelButton: 2,           // 🌟 鼠标取消键：0左键, 1中键, 2右键
  });
};


</script>

<style scoped>
.dev-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: #2d2d2d;
  border-bottom: 1px solid #111;
  user-select: none;
}
.left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
}
.inst-id {
  font-family: monospace;
  font-size: 10px;
  color: #4fc1ff;
}
.type-switch {
  background: transparent;
  border: none;
  color: #ccc;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.type-switch option {
  background: #252526;
  color: #ccc;
}
.actions button {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
}
.actions button:hover {
  color: #fff;
}
.danger:hover {
  color: #ff5f56;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  opacity: 0.6;
  vertical-align: middle;
}
.copy-btn:hover {
  opacity: 1;
}
</style>