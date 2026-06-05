import type { Operator } from '../types';

export const panelClose: Operator = {
  id: 'panel.close',
  execute({ engine, props }) {
    const { id, mode = 'singleton' } = props;
    const entity = engine.getAny(id);
    if (!entity) return;

    switch (mode) {
      case 'singleton':
        if (entity.isMaster === false) {
          engine.deleteAny(id);
        } else {
          engine.stash(id);
        }
        break;
      case 'multi':
        if (entity.isMaster) {
          engine.stash(id);
        } else {
          engine.deleteAny(id);
        }
        break;
      case 'volatile':
        engine.deleteAny(id);
        break;
    }
  }
};