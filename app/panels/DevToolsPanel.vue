<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <!-- 🌟 通用命令执行器 -->
      <div class="test-area">
        <h4>⚡ 命令执行器</h4>
        <div class="row">
          <label for="cmd-id">操作符 ID:</label>
          <input id="cmd-id" v-model="cmdId" placeholder="例如: panel.split" />
        </div>
        <div class="row">
          <label for="cmd-params">参数 (JSON):</label>
          <input id="cmd-params" v-model="cmdParams" placeholder='例如: {"targetId":"main","direction":"horizontal"}' />
        </div>
        <div class="row">
          <button @click="executeCommand">执行</button>
          <button @click="refresh">刷新</button>
        </div>
        <div v-if="cmdResult !== undefined" class="result">
          <strong>返回值:</strong> {{ cmdResult }}
        </div>
      </div>

      <!-- 面板 ID 列表 -->
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useEngine } from '../../src/renderers/vue/composables/useIai.ts';
import DevPanelHeader from '../components/DevPanelHeader.vue';

const props = defineProps({
  nodeId: { type: String, required: true },
  shared: { type: Object, default: () => ({}) },
  private: { type: Object, default: () => ({}) },
});

const engine = useEngine();

// ── 命令执行器 ──
const cmdId = ref('panel.split');
const cmdParams = ref('{"targetId":"main","direction":"horizontal"}');
const cmdResult = ref<any>(undefined);

const executeCommand = () => {
  try {
    const params = JSON.parse(cmdParams.value);
    const op = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (!op) {
      cmdResult.value = '错误: OperatorPlugin 未安装';
      return;
    }
    const res = op.exec(cmdId.value, params);
    cmdResult.value = res !== undefined ? res : '执行成功 (无返回值)';
    refresh();
  } catch (e: any) {
    cmdResult.value = `错误: ${e.message}`;
  }
};

// ── 列表刷新 ──
const activeNodes = ref<any[]>([]);
const stashNodes = ref<any[]>([]);
const freeNodes = ref<any[]>([]);

const refresh = () => {
  activeNodes.value = engine.getAllNodes().map((n) => ({ ...n }));
  stashNodes.value = engine.getAllStash();
  freeNodes.value = engine.getAllFree();
};

onMounted(() => {
  refresh();
  engine.events.on('tree:update', refresh);
  engine.events.on('free:update', refresh);
  engine.events.on('stash:update', refresh);
});

onUnmounted(() => {
  engine.events.off('tree:update', refresh);
  engine.events.off('free:update', refresh);
  engine.events.off('stash:update', refresh);
});

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};
</script>

<style scoped>
.panel { width: 100%; height: 100%; background: #1e1e1e; color: #ccc; display: flex; flex-direction: column; }
.body { flex: 1; padding: 10px; overflow-y: auto; }
.test-area { background: #252526; border: 1px solid #444; border-radius: 6px; padding: 10px; margin-bottom: 12px; }
.test-area h4 { margin: 0 0 8px; color: #569cd6; }
.row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.row label { width: 100px; font-size: 12px; color: #aaa; }
.row input { flex: 1; background: #333; border: 1px solid #555; color: #fff; padding: 4px 6px; border-radius: 3px; font-size: 12px; }
.row button { background: #0e639c; color: #fff; border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
.row button:hover { background: #1177bb; }
.result { margin-top: 6px; padding: 6px; background: #333; border-radius: 3px; font-size: 12px; color: #4ec9b0; }
h3 { margin-top: 8px; margin-bottom: 4px; }
ul { list-style: none; padding: 0; }
li { font-size: 12px; padding: 2px 0; display: flex; align-items: center; gap: 6px; }
.mini-btn { font-size: 10px; padding: 0 4px; background: #444; color: #fff; border: none; border-radius: 3px; cursor: pointer; }
.mini-btn:hover { background: #555; }
</style>