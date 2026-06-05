import type { Operator } from '../types';

export const floatFocus: Operator = {
  id: 'float.focus',
  execute({ engine, props }) {
    const { id } = props;
    if (!id) return;
    const fp = engine.getFree(id);
    if (!fp) return;

    // 置顶：设为最大 zIndex + 1
    const allFree = engine.getAllFree();
    const maxZ = allFree.reduce((max, f) => Math.max(max, f.zIndex), 0);
    engine.updateFree(id, { zIndex: maxZ + 1 });
    engine.focus(id);
  },
};