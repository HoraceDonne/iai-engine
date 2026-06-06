<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <div class="field">
        <label>当前频道（共享）</label>
        <select v-model="shared.currentChannel">
          <option value="general">综合</option>
          <option value="random">闲聊</option>
        </select>
      </div>
      <div class="field">
        <label>消息草稿（私有）</label>
        <textarea v-model="private.draftMessage" placeholder="输入消息..." />
      </div>
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
.field { margin-bottom:12px; }
select, textarea { background:#333; color:#fff; border:1px solid #555; padding:4px; }
textarea { width:100%; height:100px; resize:none; }
</style>