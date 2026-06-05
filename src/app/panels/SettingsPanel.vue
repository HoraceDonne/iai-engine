<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <div class="field">
        <label>主题</label>
        <select v-model="shared.theme">
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </select>
      </div>
      <div class="field">
        <label><input type="checkbox" v-model="shared.autoSave"> 自动保存</label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, reactive } from 'vue';
import DevPanelHeader from '../components/DevPanelHeader.vue';

const props = defineProps<{
  nodeId: string;
  instanceId?: string;
  isMaster?: boolean;
}>();

const statePool = inject<Record<string, any>>('STATE_POOL', {});
const key = props.instanceId || props.nodeId;
if (!statePool[key]) {
  statePool[key] = reactive({ theme: 'dark', autoSave: true });
}
const shared = statePool[key];
</script>

<style scoped>
.panel { width:100%; height:100%; background:#1e1e1e; color:#ccc; display:flex; flex-direction:column; }
.body { flex:1; padding:10px; display:flex; flex-direction:column; gap:10px; }
.field { display:flex; gap:8px; align-items:center; }
select, input[type="checkbox"] { background:#333; color:#fff; border:1px solid #555; padding:4px; }
</style>