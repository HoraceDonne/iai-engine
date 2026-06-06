import type { Operator } from '../types';

export const panelSplit: Operator = {
  id: 'panel.split',
  execute({ engine, props }) {
    const {
      targetId,
      direction,
      ratio = 0.5,
      insertAsSecond = true,
    } = props;

    // 获取目标面板（可能来自网格树或自由池）
    const freePanel = engine.getFree(targetId);
    const gridNode = engine.getNode(targetId);

    // ── 分割悬浮窗 ──
    if (freePanel) {
      const panel1 = engine.createMaster(freePanel.panel.panelType);
      const panel2 = engine.createMaster(freePanel.panel.panelType);

      const { x, y, width, height } = freePanel;
      engine.removeFree(targetId);

      if (direction === 'horizontal') {
        const w1 = Math.round(width * ratio);
        engine.addFree(panel1, { x, y, width: w1, height }, 200);
        engine.addFree(panel2, { x: x + w1, y, width: width - w1, height }, 200);
      } else {
        const h1 = Math.round(height * ratio);
        engine.addFree(panel1, { x, y, width, height: h1 }, 200);
        engine.addFree(panel2, { x, y: y + h1, width, height: height - h1 }, 200);
      }
      return;
    }

    // ── 分割网格面板 ──
    if (gridNode) {
      const newPanel = engine.createMaster(gridNode.panelType);
      engine.splitNode(targetId, direction, ratio, newPanel, insertAsSecond);
      return;
    }
  },
};