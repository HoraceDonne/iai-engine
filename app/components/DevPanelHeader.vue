<template>
  <div class="dev-header" @pointerdown="engine.focus(nodeId)">
    <!-- 左侧区域：标识、切换、ID、移动/停靠 -->
    <div class="left">
      <span class="badge">{{ isMaster ? '👑本体' : '👤影子' }}</span>

      <!-- 面板类型下拉切换 -->
      <select class="type-switch" :value="panelType" @change="onSwitch" @pointerdown.stop>
        <option v-for="t in panelTypes" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- 面板 ID 与复制 -->
      <span class="inst-id" :title="'ID: ' + nodeId + '\n实例: ' + (instanceId || '无')">
        {{ nodeId }}
        <button class="copy-btn" @click.stop="copyId" title="复制ID">📋</button>
      </span>

      <!-- 五宫格面板停靠拖拽 -->
      <button @pointerdown="startDocking($event)" title="面板停靠">⧉</button>
      <!-- 全局边缘停靠拖拽 -->
      <button @pointerdown="startGlobalDocking($event)" title="全局插入">⊞</button>
    </div>

    <!-- 右侧区域：原子操作按钮 -->
    <div class="actions" @pointerdown.stop>
      <button @click="operator.exec('interactive.split.cancel', { targetId: nodeId, direction: 'horizontal' })">◫</button>
      <button @click="operator.exec('panel.split', { targetId: nodeId, direction: 'vertical' })" title="垂直切割">⊟</button>
<button
  @pointerdown.prevent.stop="(e) => operator.exec('interactive.split.start', { sourceId: nodeId, mode: 'horizontal', event: e })"
  title="水平切割"
>✂️↔</button>

<button
  @pointerdown.prevent.stop="(e) => operator.exec('interactive.split.start', { sourceId: nodeId, mode: 'vertical', event: e })"
  title="垂直切割"
>✂️↕</button>
      <button @click="operator.exec('panel.float', { sourceId: nodeId, keepSource: true })" title="撕扯为独立悬浮窗(保留原面板)">🗗</button>
      <button @click="operator.exec('panel.float', { sourceId: nodeId, keepSource: false })" title="撕扯为独立悬浮窗(移除原面板)">⇱</button>
      <!-- 通用拖拽移动（悬浮窗移动） -->
<button
  @pointerdown.prevent.stop="(e) => operator.exec('float.move.start', { sourceId: nodeId, event: e })"
  title="拖拽移动"
>✥</button>
      <!-- 隐藏面板（进入暂存池） -->
      <button @click="operator.exec('panel.hide', { id: nodeId })" class="warn">👁️</button>
      <!-- 彻底关闭面板（不保留数据） -->
      <button @click="operator.exec('panel.destroy', { id: nodeId })" class="danger">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useEngine } from '../../src/renderers/vue/composables/useIai.ts';
import { OperatorPlugin } from '../../src/index';

const props = defineProps<{ nodeId: string }>();

const engine = useEngine();
const operator = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as OperatorPlugin;

// 从 IaiLayout 注入的响应式面板类型列表
const panelTypes = inject<string[]>('PANEL_TYPES', []);

// 计算当前面板的类型、是否为本体、实例 ID
const panelType = computed(() => engine.getAny(props.nodeId)?.panelType ?? '');
const isMaster = computed(() => {
  const entity = engine.getAny(props.nodeId);
  return entity?.isMaster !== false;
});
const instanceId = computed(() => {
  const entity = engine.getAny(props.nodeId);
  return entity?.instanceId ?? null;
});

// 面板类型切换
const onSwitch = (e: Event) => {
  const newType = (e.target as HTMLSelectElement).value;
  if (!newType || newType === panelType.value) return;
  operator.exec('panel.switch', { targetId: props.nodeId, newType });
};

// 复制面板 ID
const copyId = async () => {
  try {
    await navigator.clipboard.writeText(props.nodeId);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = props.nodeId;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

// 拖拽移动（适用于悬浮窗等自由面板）
const startDrag = (e: PointerEvent) => {
  const fp = engine.getFree(props.nodeId);
  const startX = fp?.x ?? 0;
  const startY = fp?.y ?? 0;

  operator.exec('drag.start', { sourceId: props.nodeId, initialX: e.clientX, initialY: e.clientY, threshold: 5 });

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

// 五宫格面板停靠
const startDocking = (e: PointerEvent) => {
  operator.exec('docking.panel', { sourceId: props.nodeId, initialX: e.clientX, initialY: e.clientY });
};

// 全局边缘停靠
const startGlobalDocking = (e: PointerEvent) => {
  operator.exec('docking.global', { sourceId: props.nodeId, initialX: e.clientX, initialY: e.clientY });
};
</script>

<style scoped>
.dev-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 8px; background: #2d2d2d; border-bottom: 1px solid #111;
  user-select: none;
}
.left { display: flex; align-items: center; gap: 6px; }
.badge { font-size: 10px; padding: 1px 4px; border-radius: 4px; }
.inst-id { font-family: monospace; font-size: 10px; color: #4fc1ff; display: flex; align-items: center; gap: 2px; }
.type-switch { background: transparent; border: none; color: #ccc; font-size: 12px; cursor: pointer; outline: none; }
.type-switch option { background: #252526; color: #ccc; }
.actions { display: flex; gap: 4px; }
.actions button { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 2px 4px; }
.actions button:hover { color: #fff; }
.danger:hover { color: #ff5f56; }
.warn:hover { color: #f0c040; }
.copy-btn { background: none; border: none; cursor: pointer; font-size: 12px; padding: 0 2px; opacity: 0.6; vertical-align: middle; }
.copy-btn:hover { opacity: 1; }
</style>