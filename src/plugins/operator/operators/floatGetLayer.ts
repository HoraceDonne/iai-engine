import type { Operator } from '../types';

export const floatGetLayer: Operator = {
  id: 'float.getLayer',
  execute({ engine, props }) {
    const { id, mode = 'max' } = props;  // mode: 'max' | 'min' | 'single'

    if (mode === 'single') {
      if (!id) return null;
      const fp = engine.getFree(id);
      return fp?.zIndex ?? null;
    }

    const allFree = engine.getAllFree();
    if (allFree.length === 0) return mode === 'max' ? 0 : 9999;

    const zValues = allFree.map(f => f.zIndex);
    return mode === 'max' ? Math.max(...zValues) : Math.min(...zValues);
  },
};