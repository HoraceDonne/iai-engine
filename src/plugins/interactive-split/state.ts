// src/plugins/interactive-split/state.ts
import { reactive } from 'vue';

export const splitState = reactive({
  isActive: false,
  isHovering: false, // 鼠标是否在锁定的面板内？
  mode: 'horizontal' as 'horizontal' | 'vertical', 
  sourceId: null as string | null, // 🌟 唯一被锁死的面板 ID
  direction: 'horizontal' as 'horizontal' | 'vertical',
  x: 0,
  y: 0,
  length: 0,
  isSnapped: false,
  newPanelType: undefined as string | undefined, 
});