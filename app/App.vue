<template>
  <!-- 模拟窗口壳：绑定动态尺寸 -->
  <div
    ref="shellRef"
    class="window-shell"
    :style="{
      width: shellSize.width + 'px',
      height: shellSize.height + 'px',
      left: shellPos.x + 'px',
      top: shellPos.y + 'px'
    }"
  >
    <!-- 内部布局占据壳的所有空间（减去标题栏高度） -->
    <div class="shell-content">
      <IaiLayout :engine="engine" />
    </div>

    <!-- 窗口标题栏（拖拽移动用） -->
    <div class="window-titlebar" @pointerdown="startMoveShell">
      <span>Iai 布局测试窗口</span>
      <span class="size-indicator">{{ shellSize.width }} × {{ shellSize.height }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { IaiEngine, IaiLayout, OperatorPlugin, DominoPlugin, DockingPlugin, InteractiveSplitPlugin, FloatPlugin  } from '../src/index';

// 引入面板组件（根据实际路径调整）
import SettingsPanel from './panels/SettingsPanel.vue';
import ChatPanel from './panels/ChatPanel.vue';
import EditorPanel from './panels/EditorPanel.vue';
import InspectorPanel from './panels/InspectorPanel.vue';
import DevToolsPanel from './panels/DevToolsPanel.vue';

// ── 引擎初始化 ──
const engine = new IaiEngine()
  .reg('settings', SettingsPanel, { shared: true })
  .reg('chat', ChatPanel, { shared: true })
  .reg('editor', EditorPanel, {
    minSize: 20,
    meta: { snapThreshold: 400 }
  })
  .reg('inspector', InspectorPanel, { shared: false })
  .reg('devtools', DevToolsPanel, { shared: false, title: '开发者工具' })
  .use(new OperatorPlugin())
  .use(new DominoPlugin({ fpsLimit: 120, deadzone: 2.0, rigidClamp: true, snapToMin: true }))
  .use(new DockingPlugin())
  engine.use(new InteractiveSplitPlugin({snapToCenter: false,
  snapThreshold: 20,}))
  .use(new FloatPlugin ({
    cornerOnly: false,
    enableSnap: true,
    snapThreshold: 20
  }));

engine.mount({
  type: 'leaf',
  id: 'main',
  panelType: 'settings',
  isMaster: true
});

// 开发调试
(window as any).engine = engine;
(window as any).operator = engine.getPlugins().find(p => p.name === 'OperatorPlugin');

// ── 窗口壳状态 ──
const shellRef = ref<HTMLElement | null>(null);
const shellSize = reactive({ width: 800, height: 600 });
const shellPos = reactive({ x: 100, y: 80 }); // 初始偏移位置

// 缩放状态
let isResizing = false;
let startSize = { width: 800, height: 600 };
let startMouse = { x: 0, y: 0 };

// 移动状态
let isMoving = false;
let moveStart = { x: 0, y: 0 };
let startShellPos = { x: 0, y: 0 };

// ── 缩放逻辑 ──
const onResizeStart = (e: PointerEvent) => {
  const rect = shellRef.value?.getBoundingClientRect();
  if (!rect) return;
  // 仅右下角 20px 区域触发缩放
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < rect.width - 20 || y < rect.height - 20) return;

  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  startMouse.x = e.clientX;
  startMouse.y = e.clientY;
  startSize.width = shellSize.width;
  startSize.height = shellSize.height;

  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd);
};

const onResizeMove = (e: PointerEvent) => {
  if (!isResizing) return;
  const dx = e.clientX - startMouse.x;
  const dy = e.clientY - startMouse.y;
  shellSize.width = Math.max(300, startSize.width + dx);
  shellSize.height = Math.max(200, startSize.height + dy);
};

const onResizeEnd = () => {
  isResizing = false;
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
};

// ── 移动逻辑 ──
const startMoveShell = (e: PointerEvent) => {
  // 只允许拖动标题栏空白处
  if ((e.target as HTMLElement).closest('.size-indicator')) return;
  isMoving = true;
  startMouse.x = e.clientX;
  startMouse.y = e.clientY;
  startShellPos.x = shellPos.x;
  startShellPos.y = shellPos.y;

  const onMove = (ev: PointerEvent) => {
    if (!isMoving) return;
    shellPos.x = startShellPos.x + (ev.clientX - startMouse.x);
    shellPos.y = startShellPos.y + (ev.clientY - startMouse.y);
  };
  const onUp = () => {
    isMoving = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
};

onMounted(() => {
  if (shellRef.value) {
    shellRef.value.addEventListener('pointerdown', onResizeStart);
  }
});

onUnmounted(() => {
  if (shellRef.value) {
    shellRef.value.removeEventListener('pointerdown', onResizeStart);
  }
});
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0f0f0f;
}

/* 模拟窗口壳（绝对定位，可通过左上角坐标移动） */
.window-shell {
  position: absolute;
  border: 2px solid #444;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
  box-shadow: 0 0 20px rgba(0,0,0,0.6);
}

/* 内部内容占满壳（留出标题栏高度） */
.shell-content {
  width: 100%;
  height: calc(100% - 28px); /* 28px 标题栏 */
  margin-top: 28px; /* 避免被标题栏遮挡 */
  position: relative;
}

/* 标题栏 */
.window-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  background: #2d2d2d;
  border-bottom: 1px solid #111;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  color: #ccc;
  font-size: 12px;
  font-family: sans-serif;
  cursor: move;
  user-select: none;
  z-index: 10;
}

.size-indicator {
  font-size: 0.8em;
  color: #888;
}

/* 右下角调整大小手柄可视化 */
.window-shell::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.3) 70%, transparent 70%);
  cursor: nwse-resize;
  z-index: 20;
}
</style>