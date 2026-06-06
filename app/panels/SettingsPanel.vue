<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body" :class="{ compact: isCompact }">
      <div class="nav-bar">
        <span class="nav-item" title="常规设置">
          <span class="nav-icon">⚙️</span>
          <span class="nav-label">常规</span>
        </span>
        <span class="nav-item" title="外观设置">
          <span class="nav-icon">🎨</span>
          <span class="nav-label">外观</span>
        </span>
        <span class="nav-item" title="快捷键设置">
          <span class="nav-icon">⌨️</span>
          <span class="nav-label">快捷键</span>
        </span>
      </div>

      <div class="content">
        <div class="field">
          <label for="settings-theme">主题</label>
          <select id="settings-theme" v-model="shared.theme">
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
        <div class="field">
          <input id="settings-autosave" type="checkbox" v-model="shared.autoSave" />
          <label for="settings-autosave">自动保存</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useEngine } from '../../src/renderers/vue/composables/useIai.ts'
import DevPanelHeader from '../components/DevPanelHeader.vue'

const props = defineProps({
  nodeId: { type: String, required: true },
  shared: { type: Object, default: () => ({}) },
  private: { type: Object, default: () => ({}) }
})

const engine = useEngine()

// ── 折叠阈值（可在这里调整） ──
const FOLD_THRESHOLD = 400

// 当前面板宽度
const panelWidth = ref(0)

const isCompact = computed(() => panelWidth.value < FOLD_THRESHOLD)

const updateWidth = () => {
  const el = document.querySelector(`[data-node-id="${props.nodeId}"]`)
  if (el) {
    panelWidth.value = Math.round(el.getBoundingClientRect().width)
  }
}

onMounted(() => {
  updateWidth()
  const observer = new ResizeObserver(updateWidth)
  const el = document.querySelector(`[data-node-id="${props.nodeId}"]`)
  if (el) observer.observe(el)
  onUnmounted(() => observer.disconnect())
})
</script>

<style scoped>
.panel { width: 100%; height: 100%; background: #1e1e1e; color: #ccc; display: flex; flex-direction: column; }
.body { flex: 1; display: flex; overflow: hidden; }
.nav-bar { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: #252526; border-right: 1px solid #333; }
.nav-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.nav-item:hover { background: #333; }
.nav-icon { font-size: 16px; }
.nav-label { font-size: 12px; }
.content { flex: 1; padding: 10px; overflow-y: auto; }
.field { margin-bottom: 12px; }

/* 紧凑模式：隐藏文字，只显示图标，导航条变窄 */
.body.compact .nav-bar { padding: 4px; gap: 6px; }
.body.compact .nav-item { justify-content: center; padding: 4px; }
.body.compact .nav-label { display: none; }
</style>