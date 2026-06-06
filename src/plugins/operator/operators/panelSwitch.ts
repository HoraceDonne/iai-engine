// src/plugins/operator/operators/panelSwitch.ts
import type { Operator } from '../types';

export const panelSwitch: Operator = {
  id: 'panel.switch',
  execute({ engine, props }) {
    const { targetId, newType, targetPanelId } = props;
    const oldEntity = engine.getAny(targetId);
    if (!oldEntity || newType === oldEntity.panelType) return;

    // ── 手动指定模式：恢复指定面板，暂存当前面板 ──
    if (targetPanelId) {
      const specified = engine.getAny(targetPanelId) || engine.getStash(targetPanelId);
      if (!specified) return;
      
      // 如果指定面板在暂存池中，先取出
      if (engine.getStash(targetPanelId)) {
        engine.removeStash(targetPanelId);
      }
      
      // 执行替换：指定面板上场
      engine.replace(targetId, specified);
      
      // 当前面板暂存（不删除）
      engine.addToStash(oldEntity);
      return;
    }

    // ── 默认模式：原地修改面板类型，不创建新面板，不暂存旧面板 ──
    const switched = {
      ...oldEntity,
      panelType: newType,
    };

    engine.replace(targetId, switched);
  },
};