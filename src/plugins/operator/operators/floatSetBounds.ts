import type { Operator } from '../types';

export const floatSetBounds: Operator = {
  id: 'float.setBounds',
  execute({ engine, props }) {
    const { id, offsets } = props;
    if (!offsets) return;

    const fp = engine.getFree(id);
    if (!fp) return;

    // 深合并到 meta.guides
    if (!fp.panel.meta) fp.panel.meta = {};
    fp.panel.meta.guides = {
      ...fp.panel.meta.guides,
      ...offsets,
    };

    // 触发更新（让可视化层刷新参考线）
    engine.events.emit('free:update', { count: engine.getAllFree().length });
  },
};