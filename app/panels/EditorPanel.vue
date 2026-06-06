<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <textarea v-model="private.code" placeholder="输入代码..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import DevPanelHeader from '../components/DevPanelHeader.vue'

const props = defineProps({
  nodeId: { type: String, required: true },
  shared: { type: Object, default: () => ({}) },
  private: { type: Object, default: () => ({}) }
})
</script>

<style scoped>
.panel { width:100%; height:100%; background:#1e1e1e; color:#ccc; display:flex; flex-direction:column; }
.body { flex:1; padding:10px; }
textarea { width:100%; height:100%; background:#333; color:#fff; border:none; resize:none; }
</style>