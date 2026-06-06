import type { Operator } from '../types';

export const panelHide: Operator = {
  id: 'panel.hide',
  execute({ engine, props }) {
    const { id } = props;
    engine.stash(id); // 隐藏面板，放入暂存池
  }
};