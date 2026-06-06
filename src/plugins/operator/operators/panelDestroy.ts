import type { Operator } from '../types';

export const panelDestroy: Operator = {
  id: 'panel.destroy',
  execute({ engine, props }) {
    const { id } = props;
    engine.deleteAny(id); // 真销毁面板
  }
};