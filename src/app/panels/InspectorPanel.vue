<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <h3>活跃节点 ({{ activeNodes.length }})</h3>
      <ul>
        <li v-for="n in activeNodes" :key="n.id">
          {{ n.panelType }} ({{ n.id.slice(-4) }}) - {{ n.isMaster ? '本体' : '影子' }}
        </li>
      </ul>
      <h3>暂存池 ({{ stashNodes.length }})</h3>
      <ul>
        <li v-for="s in stashNodes" :key="s.id">
          {{ s.panelType }} ({{ (s.instanceId || s.id).slice(-4) }}) 
        </li>
      </ul>
      <h3>自由池 ({{ freeNodes.length }})</h3>
      <ul>
        <li v-for="f in freeNodes" :key="f.id">{{ f.panel.panelType }} ({{ f.id.slice(-4) }})</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useEngine } from '../../renderers/vue/composables/useIai';
import type { OperatorPlugin } from '../../plugins/operator';
import DevPanelHeader from '../components/DevPanelHeader.vue';

const props = defineProps<{ nodeId: string }>();
const engine = useEngine();

const activeNodes = ref<any[]>([]);
const stashNodes = ref<any[]>([]);
const freeNodes = ref<any[]>([]);

const refresh = () => {
  activeNodes.value = engine.getAllNodes().map(n => ({ ...n }));
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
</script>

<style scoped>
.panel { width:100%; height:100%; background:#1e1e1e; color:#ccc; display:flex; flex-direction:column; }
.body { flex:1; padding:10px; overflow-y:auto; }
h3 { margin-top: 8px; margin-bottom: 4px; }
ul { list-style:none; padding:0; }
li { font-size:12px; padding:2px; }
button { background:#444; color:#fff; border:none; padding:2px 4px; cursor:pointer; }
</style>