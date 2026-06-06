import type { Operator } from '../types';

export const panelFloat: Operator = {
  id: 'panel.float',
  execute({ engine, props }) {
    const {
      sourceId,
      x = 200,
      y = 200,
      keepSource = true,
    } = props;

    const entity = engine.getAny(sourceId);
    if (!entity) return;

    // 创建新本体（数据共享由注册配置和 $shared/$private 决定）
    const panel = engine.createMaster(entity.panelType);
    engine.addFree(panel, { x, y, width: 400, height: 300 }, 200);

    // 如果不保留旧面板，则隐藏旧面板
    if (!keepSource) {
      engine.stash(sourceId);
    }
  },
};