<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">

      <!-- 🌟 手动切换测试区域 -->
      <div class="test-area">
        <h4>切换测试</h4>
        <div class="row">
          <label>源ID:</label>
          <input v-model="sourceId" placeholder="main" />
        </div>
        <div class="row">
          <label>新类型:</label>
          <input v-model="targetType" placeholder="chat" />
        </div>
        <div class="row">
          <label>目标ID(可选):</label>
          <input v-model="targetPanelId" placeholder="留空为默认切换" />
        </div>
        <button @click="doSwitch">执行切换</button>
        <button @click="refresh">刷新列表</button>
      </div>

      <h3>活跃节点 ({{ activeNodes.length }})</h3>
      <ul>
        <li v-for="n in activeNodes" :key="n.id">
          {{ n.panelType }} ({{ n.id }})
          <button @click="copy(n.id)" class="mini-btn">📋</button>
        </li>
      </ul>

      <h3>暂存池 ({{ stashNodes.length }})</h3>
      <ul>
        <li v-for="s in stashNodes" :key="s.id">
          {{ s.panelType }} ({{ s.instanceId || s.id }})
          <button @click="copy(s.instanceId || s.id)" class="mini-btn">📋</button>
        </li>
      </ul>

      <h3>自由池 ({{ freeNodes.length }})</h3>
      <ul>
        <li v-for="f in freeNodes" :key="f.id">
          {{ f.panel.panelType }} ({{ f.id }})
          <button @click="copy(f.id)" class="mini-btn">📋</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useEngine } from '../../src/renderers/vue/composables/useIai.ts'
import type { OperatorPlugin } from '../../src/plugins/operator'
import DevPanelHeader from '../components/DevPanelHeader.vue'

const props = defineProps({
  nodeId: { type: String, required: true },
  shared: { type: Object, default: () => ({}) },
  private: { type: Object, default: () => ({}) }
})

const engine = useEngine()

// ── 切换测试 ──
const sourceId = ref('main')
const targetType = ref('chat')
const targetPanelId = ref('')

const doSwitch = () => {
  const op = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any
  if (!op) return
  const params: any = {
    targetId: sourceId.value,
    newType: targetType.value,
  }
  if (targetPanelId.value.trim()) {
    params.targetPanelId = targetPanelId.value.trim()
  }
  op.exec('panel.switch', params)
  refresh()
}

// ── 列表刷新 ──
const activeNodes = ref<any[]>([])
const stashNodes = ref<any[]>([])
const freeNodes = ref<any[]>([])

const refresh = () => {
  activeNodes.value = engine.getAllNodes().map(n => ({ ...n }))
  stashNodes.value = engine.getAllStash()
  freeNodes.value = engine.getAllFree()
}

onMounted(() => {
  refresh()
  engine.events.on('tree:update', refresh)
  engine.events.on('free:update', refresh)
  engine.events.on('stash:update', refresh)
})

onUnmounted(() => {
  engine.events.off('tree:update', refresh)
  engine.events.off('free:update', refresh)
  engine.events.off('stash:update', refresh)
})

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}
</script>