// src/plugins/operator/operators/panelSwitch.ts
import type { Operator } from '../types';

export const panelSwitch: Operator = {
  id: 'panel.switch',
  execute({ engine, props }) {
    const { targetId, newType, mode = 'singleton' } = props;
    const oldEntity = engine.getAny(targetId);
    if (!oldEntity) return;

    let newPanel;
    if (mode === 'singleton') {
      const allActive = [
        ...engine.getAllNodes(),
        ...engine.getAllFree().map((fp: any) => fp.panel),
      ];
      const activeMaster = allActive.find(
        (n: any) => n.panelType === newType && n.isMaster !== false
      );
      
      if (activeMaster) {
        newPanel = engine.createShadow(activeMaster, newType); // 🌟 修复
      } else {
        const stashed = engine.getAllStash().find(
          (s: any) => s.panelType === newType && s.isMaster !== false
        );
        if (stashed) {
          engine.removeStash(stashed.instanceId || stashed.id);
          newPanel = stashed;
        } else {
          newPanel = engine.createMaster(newType); // 🌟 修复
        }
      }
    } else {
      newPanel = engine.createMaster(newType); // 🌟 修复
    }

    // 🌟 修复：直接替换实体即可，默认值读取交由底层求解器处理
    engine.replace(targetId, newPanel);
    
    if (oldEntity.isMaster) {
      engine.addToStash(oldEntity);
    } else if (!engine.getFree(targetId)) {
      engine.deleteAny(oldEntity.id);
    }
  }
};