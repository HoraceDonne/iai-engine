import type { Operator } from '../types';

export const floatSetLayer: Operator = {
  id: 'float.setLayer',
  execute({ engine, props }) {
    const { id, zIndex } = props;
    if (typeof zIndex !== 'number') return;

    const fp = engine.getFree(id);
    if (!fp) return;

    engine.updateFree(id, { zIndex });
  },
};