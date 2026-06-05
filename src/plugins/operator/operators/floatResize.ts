// src/plugins/operator/operators/floatResize.ts
import type { Operator } from '../types';

export const floatResize: Operator = {
  id: 'float.resize',
  execute({ engine, props }) {
    const { id, width, height } = props;
    if (typeof width !== 'number' || typeof height !== 'number') return;

    const fp = engine.getFree(id);
    if (!fp) return;

    engine.updateFree(id, { width, height });
  },
};