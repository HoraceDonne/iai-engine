<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <textarea v-model="shared.text" placeholder="输入多行文本，测试状态共享..."></textarea>
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
  statePool[key] = reactive({ text: '' });
}
const shared = statePool[key];
</script>

<style scoped>
.panel { width:100%; height:100%; background:#1e1e1e; color:#ccc; display:flex; flex-direction:column; }
.body { flex:1; padding:10px; }
textarea { width:100%; height:100%; background:#333; color:#fff; border:none; resize:none; }
</style>