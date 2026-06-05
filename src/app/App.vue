<template>
  <div
    class="os-window"
    :style="{ left: winPos.x + 'px', top: winPos.y + 'px', width: winSize.w + 'px', height: winSize.h + 'px' }"
  >
    <div class="os-window-header" @pointerdown="startWindowDrag">
      <span class="win-title">Iai 布局引擎 · 完整多面板测试 (v2.0 架构)</span>
    </div>

    <div class="os-window-body">
      <IaiLayout :engine="engine">
        <template #overlay>
          <component
            v-for="plugin in overlayPlugins"
            :key="plugin.name"
            :is="(plugin as any).overlayComponent"
          />
        </template>
      </IaiLayout>
    </div>

    <div
      class="os-window-resizer"
      @pointerdown.prevent="startResize"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { markRaw, computed, provide, reactive, ref } from 'vue';
import { IaiEngine } from '../core/IaiEngine';
import IaiLayout from '../renderers/vue/components/IaiLayout.vue';

// 引入面板 UI 组件 (现在它们里面极其干净，只有纯 UI)
import TestPanel from './panels/TestPanel.vue';
import TextEditorPanel from './panels/TextEditorPanel.vue';
import InspectorPanel from './panels/InspectorPanel.vue';
import SettingsPanel from './panels/SettingsPanel.vue';

// 引入核心插件
import { OperatorPlugin } from '../plugins/operator';
import { DominoPlugin } from '../plugins/domino';
import { DockingPlugin } from '../plugins/docking';
import { InteractiveSplitPlugin } from '../plugins/interactive-split';
import { FloatResizePlugin } from '../plugins/float-resize';

const winPos = ref({ x: 100, y: 50 });
const winSize = ref({ w: 1000, h: 650 });

// ── 窗口拖拽 ──
let isDraggingWindow = false;
let dragStartOffset = { x: 0, y: 0 };

const startWindowDrag = (e: PointerEvent) => {
  isDraggingWindow = true;
  dragStartOffset.x = e.clientX - winPos.value.x;
  dragStartOffset.y = e.clientY - winPos.value.y;
  window.addEventListener('pointermove', onWindowDrag);
  window.addEventListener('pointerup', stopWindowDrag);
};

const onWindowDrag = (e: PointerEvent) => {
  if (!isDraggingWindow) return;
  winPos.value.x = e.clientX - dragStartOffset.x;
  winPos.value.y = e.clientY - dragStartOffset.y;
};

const stopWindowDrag = () => {
  isDraggingWindow = false;
  window.removeEventListener('pointermove', onWindowDrag);
  window.removeEventListener('pointerup', stopWindowDrag);
};

// ── 窗口调整大小 ──
let isResizing = false;
let resizeStart = { x: 0, y: 0, w: 0, h: 0 };

const startResize = (e: PointerEvent) => {
  e.stopPropagation();
  isResizing = true;
  resizeStart.x = e.clientX;
  resizeStart.y = e.clientY;
  resizeStart.w = winSize.value.w;
  resizeStart.h = winSize.value.h;

  window.addEventListener('pointermove', onResize);
  window.addEventListener('pointerup', stopResize);
  document.body.style.userSelect = 'none';
};

const onResize = (e: PointerEvent) => {
  if (!isResizing) return;
  const dw = e.clientX - resizeStart.x;
  const dh = e.clientY - resizeStart.y;
  winSize.value.w = Math.max(400, resizeStart.w + dw);
  winSize.value.h = Math.max(300, resizeStart.h + dh);
};

const stopResize = () => {
  isResizing = false;
  window.removeEventListener('pointermove', onResize);
  window.removeEventListener('pointerup', stopResize);
  document.body.style.userSelect = '';
};

// ── 全局状态池 ──
const statePool = reactive<Record<string, any>>({});
provide('STATE_POOL', statePool);

// ════════════════════════════════════════════════════════
// 🌟 引擎初始化与显式注册核心区域 🌟
// ════════════════════════════════════════════════════════
const engine = new IaiEngine()
  // 1. 注册工作台：允许开多个 (multi)，最小 150px
  .reg('test', markRaw(TestPanel), {
    title: '测试工作台',
    icon: '🧪',
    minSize: 40,
    defaultWidth: 20,
    defaultHeight: 20,
    lifecycle: 'multi'
  })
  // 2. 注册文本编辑器：允许开多个 (multi)，最小 200px
  .reg('textEditor', markRaw(TextEditorPanel), {
    title: '文本编辑器',
    icon: '📝',
    minSize: 200,
    defaultWidth: 500,
    lifecycle: 'multi'
  })
  // 3. 注册检查器：全局单例 (singleton)，最小 250px
  .reg('inspector', markRaw(InspectorPanel), {
    title: '属性检查器',
    icon: '⚙️',
    minSize: 250,
    defaultWidth: 300,
    lifecycle: 'singleton'
  })
  // 4. 注册设置面板：全局单例 (singleton)，较大尺寸要求
  .reg('settings', markRaw(SettingsPanel), {
    title: '系统设置',
    icon: '🛠️',
    minSize: 300,
    defaultWidth: 400,
    lifecycle: 'singleton'
  })
  // 5. 挂载插件
  .use(new OperatorPlugin())
  .use(new DominoPlugin({ fpsLimit: 120, deadzone: 2.0, rigidClamp: true })) // 开启刚体锁死
  .use(new DockingPlugin())
  .use(new InteractiveSplitPlugin())
  .use(new FloatResizePlugin({ cornerOnly: false }));

// 提供面板类型列表给 UI 层的下拉菜单使用
provide('PANEL_TYPES', ['test', 'textEditor', 'inspector', 'settings']);

// 🌟 极简初始挂载：引擎会自动从上面注册的图纸中读取 minSize 和 lifecycle
engine.mount({
  type: 'leaf',
  id: 'main',
  panelType: 'test',
  isMaster: true
});

// ── 插件覆盖层 ──
const overlayPlugins = computed(() =>
  engine.getPlugins().filter(p => (p as any).overlayComponent)
);

(window as any).engine = engine;
(window as any).operator = engine.getPlugins().find(p => p.name === 'OperatorPlugin');
</script>

<style>
html, body, #app {
  margin: 0; padding: 0; width: 100vw; height: 100vh;
  overflow: hidden; background: #111;
  font-family: sans-serif;
}

/* 模拟窗口外壳 */
.os-window {
  position: absolute;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: none; /* 我们自己控制调整大小 */
  min-width: 400px;
  min-height: 300px;
}

/* 窗口标题栏 */
.os-window-header {
  height: 32px;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: grab;
  user-select: none;
  border-bottom: 1px solid #111;
  flex-shrink: 0;
}
.os-window-header:active {
  cursor: grabbing;
}
.win-title {
  font-size: 12px;
  color: #888;
}

/* 窗口主体（IaiLayout 的宿主） */
.os-window-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 右下角拖拽手柄 */
.os-window-resizer {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 20px;          /* 稍微增大，便于操作 */
  height: 20px;
  cursor: nwse-resize;
  background: rgba(255, 255, 255, 0.15);
  border-top-left-radius: 4px;
  z-index: 10;          /* 确保在最上层 */
}
.os-window-resizer:hover {
  background: rgba(0, 122, 204, 0.7);
}
</style>