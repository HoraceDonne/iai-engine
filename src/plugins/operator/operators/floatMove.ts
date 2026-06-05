// src/plugins/operator/operators/floatMove.ts
import type { Operator } from '../types';

export const floatMove: Operator = {
  id: 'float.move',
  execute({ engine, props }) {
    const { id, x, y } = props;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const fp = engine.getFree(id);
    if (!fp) return;

    engine.updateFree(id, { x, y });
  },
};