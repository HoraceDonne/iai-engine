// src/plugins/operator/operators/panelFloat.ts
import type { Operator } from '../types';
import type { PanelEntity, LifecycleMode } from '../../../core/types';

export const panelFloat: Operator = {
  id: 'panel.float',
  execute({ engine, props }) {
    const {
      sourceId,
      mode = 'singleton',
      x = 200,
      y = 200,
      keepSource = true,
    } = props;
    const entity = engine.getAny(sourceId);
    if (!entity) return;

    let panel: PanelEntity;
    if (mode === 'singleton') {
      const master = (() => {
        const allActive = [
          ...engine.getAllNodes(),
          ...engine.getAllFree().map((fp: any) => fp.panel),
        ];
        const activeMaster = allActive.find(
          (n: any) => n.panelType === entity.panelType && n.isMaster !== false
        );
        if (activeMaster) return activeMaster;
        
        const stashed = engine.getAllStash().find(
          (s: any) => s.panelType === entity.panelType && s.isMaster !== false
        );
        if (stashed) return stashed;
        
        const m = engine.createMaster(entity.panelType); // 🌟 修复
        engine.addToStash(m);
        return m;
      })();
      panel = engine.createShadow(master, entity.panelType, entity); // 🌟 修复
    } else if (mode === 'multi') {
      panel = engine.createMaster(entity.panelType, entity); // 🌟 修复
    } else {
      panel = {
        id: `eph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panelType: entity.panelType,
        isMaster: true,
        lifecycle: 'volatile' as const,
        minSize: entity.minSize,
        maxSize: entity.maxSize,
        resizable: entity.resizable,
        meta: entity.meta ? { ...entity.meta } : undefined,
      };
    }

    // 🌟 修复：通过 getPanelProps 获取图纸定义的宽高
    const finalProps = engine.getPanelProps(panel);
    engine.addFree(panel, { x, y, width: finalProps.defaultWidth || 400, height: finalProps.defaultHeight || 300 }, 200);
    
    if (!keepSource) {
      if (entity.isMaster === false) {
        engine.deleteAny(sourceId);
      } else {
        engine.stash(sourceId);
      }
    }
  },
};