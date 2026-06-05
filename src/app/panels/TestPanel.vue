<template>
  <div class="panel">
    <DevPanelHeader :node-id="nodeId" />
    <div class="body">
      <div class="info">
        <span class="badge">{{ isMaster ? '👑本体' : '👤影子' }}</span>
        <span class="inst-id">实例: {{ instanceId?.slice(-4) ?? '无' }}</span>
        <!-- 🌟 新增：实时显示 minSize 和当前宽度 -->
        <span class="debug">minSize: {{ nodeMinSize ?? '?' }} | 宽: {{ nodeWidth }}px</span>
      </div>

      <div class="field">
        <label>文本输入</label>
        <input v-model="shared.text" placeholder="输入文字，多个视图共享" />
      </div>

      <div class="field">
        <label>滑块值：{{ shared.slider }}</label>
        <input type="range" v-model="shared.slider" min="0" max="100" />
      </div>

      <p class="hint">关闭后恢复，数据自动保留</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, reactive, computed, ref, onMounted, onUnmounted } from 'vue';
import DevPanelHeader from '../components/DevPanelHeader.vue';
import { useEngine } from '../../renderers/vue/composables/useIai';

const props = defineProps<{
  nodeId: string;
  instanceId?: string;
  isMaster?: boolean;
}>();

const engine = useEngine();
const statePool = inject<Record<string, any>>('STATE_POOL', {});
const key = props.instanceId || props.nodeId;
if (!statePool[key]) {
  statePool[key] = reactive({ text: '', slider: 50 });
}
const shared = statePool[key];

// 🌟 获取当前面板的 minSize 属性
const nodeMinSize = computed(() => {
  const node = engine.getNode(props.nodeId);
  return node?.minSize;
});

// 🌟 获取当前面板的实际渲染宽度
const nodeWidth = ref(0);
const updateWidth = () => {
  const el = document.querySelector(`[data-node-id="${props.nodeId}"]`);
  if (el) {
    nodeWidth.value = Math.round(el.getBoundingClientRect().width);
  }
};
onMounted(() => {
  updateWidth();
  const observer = new ResizeObserver(updateWidth);
  const el = document.querySelector(`[data-node-id="${props.nodeId}"]`);
  if (el) observer.observe(el);
  onUnmounted(() => observer.disconnect());
});
</script>

<style scoped>
/* 原有样式保持不变，增加 .debug 样式 */
.debug {
  font-size: 10px;
  color: #f0c040;
  margin-left: 8px;
  font-family: monospace;
}
</style>