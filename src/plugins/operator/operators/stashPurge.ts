import type { Operator } from '../types';

export const stashPurge: Operator = {
  id: 'stash.purge',
  execute({ engine, props }) {
    const { panelType } = props;
    const list = panelType
      ? engine.getAllStash().filter((s: any) => s.panelType === panelType)
      : engine.getAllStash();
    for (const entity of list) {
      engine.removeStash(entity.instanceId || entity.id);
    }
  }
};