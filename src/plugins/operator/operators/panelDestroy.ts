import type { Operator } from '../types';

export const panelDestroy: Operator = {
  id: 'panel.destroy',
  execute({ engine, props }) {
    const { id } = props;
    const entity = engine.getAny(id);
    if (!entity) return;
    // 从活跃区删除
    engine.deleteAny(id);
    // 从暂存池删除
    const stashKey = entity.instanceId || entity.id;
    if (engine.getStash(stashKey)) {
      engine.removeStash(stashKey);
    }
  }
};