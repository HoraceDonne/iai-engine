import type { Operator } from '../types';

export const stashRestore: Operator = {
  id: 'stash.restore',
  execute({ engine, props }) {
    const { instanceId, x = 200, y = 200 } = props;
    const entity = engine.getStash(instanceId);
    if (!entity) return;
    engine.removeStash(instanceId);
    engine.addFree(entity, { x, y, width: 400, height: 300 }, 200);
  }
};