// src/plugins/operator/operators/panelSplit.ts
import type { LifecycleMode, PanelEntity } from '../../../core/types';
import type { Operator } from '../types';

// 辅助函数：为单例模式查找或创建本体
function ensureSingletonMaster(engine: any, panelType: string) {
  const allActive = [
    ...engine.getAllNodes(),
    ...engine.getAllFree().map((fp: any) => fp.panel),
  ];
  const activeMaster = allActive.find(
    (n: any) => n.panelType === panelType && n.isMaster !== false
  );
  if (activeMaster) return activeMaster;

  const stashed = engine.getAllStash().find(
    (s: any) => s.panelType === panelType && s.isMaster !== false
  );
  if (stashed) return stashed;

  const master = engine.createMaster(panelType);
  engine.addToStash(master);
  return master;
}

// 根据模式创建面板（轻量级，不查图纸）
function createPanelByMode(engine: any, panelType: string, mode: string, sourceNode?: any): PanelEntity {
  let panel: PanelEntity;
  switch (mode) {
    case 'singleton': {
      const master = ensureSingletonMaster(engine, panelType);
      panel = engine.createShadow(master, panelType, sourceNode);
      break;
    }
    case 'multi': {
      panel = engine.createMaster(panelType, sourceNode);
      break;
    }
    case 'volatile': {
      const id = `eph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      panel = { id, panelType, isMaster: true, lifecycle: 'volatile' as LifecycleMode };
      break;
    }
    default:
      panel = engine.createMaster(panelType, sourceNode);
  }
  return panel;
}

export const panelSplit: Operator = {
  id: 'panel.split',
  execute({ engine, props }) {
    const {
      targetId,
      direction,
      panelType: newPanelType,
      mode = 'singleton',
      ratio = 0.5,            // 🌟 比例分割 (0~1)
      pixels,                 // 🌟 像素分割 (绝对值)
      insertAsSecond = true   // 🌟 插入方向 (true:右/下, false:左/上)
    } = props;
    
    const freePanel = engine.getFree(targetId);
    const gridNode = engine.getNode(targetId);
    
    // ── 1. 处理悬浮窗的切割 ──
    if (freePanel) {
      const type = newPanelType || freePanel.panel.panelType;

      const panel1 = createPanelByMode(engine, type, mode, freePanel.panel);
      const panel2 = createPanelByMode(engine, type, mode, freePanel.panel);

      const x = freePanel.x;
      const y = freePanel.y;
      const w = freePanel.width;
      const h = freePanel.height;

      // 🌟 换算像素值为比例
      let finalRatio = ratio;
      if (pixels !== undefined) {
        finalRatio = direction === 'horizontal' ? pixels / w : pixels / h;
      }
      finalRatio = Math.max(0, Math.min(1, finalRatio)); // 确保不出界

      engine.removeFree(targetId);

      if (direction === 'horizontal') {
        const w1 = Math.round(w * finalRatio);
        const w2 = w - w1;
        // insertAsSecond 为 true 时，新产生的面板2 在右侧
        if (insertAsSecond) {
          engine.addFree(panel1, { x, y, width: w1, height: h }, 200);
          engine.addFree(panel2, { x: x + w1, y, width: w2, height: h }, 200);
        } else {
          engine.addFree(panel2, { x, y, width: w1, height: h }, 200);
          engine.addFree(panel1, { x: x + w1, y, width: w2, height: h }, 200);
        }
      } else {
        const h1 = Math.round(h * finalRatio);
        const h2 = h - h1;
        // insertAsSecond 为 true 时，新产生的面板2 在下方
        if (insertAsSecond) {
          engine.addFree(panel1, { x, y, width: w, height: h1 }, 200);
          engine.addFree(panel2, { x, y: y + h1, width: w, height: h2 }, 200);
        } else {
          engine.addFree(panel2, { x, y, width: w, height: h1 }, 200);
          engine.addFree(panel1, { x, y: y + h1, width: w, height: h2 }, 200);
        }
      }
      return;
    }

    // ── 2. 处理网格面板的切割 ──
    if (gridNode) {
      const type = newPanelType || gridNode.panelType;
      const newPanel = createPanelByMode(engine, type, mode, gridNode);

      // 🌟 换算像素值为比例
      let finalRatio = ratio;
      if (pixels !== undefined) {
        // 为了换算像素，必须向求解器查询目标面板此刻的真实物理大小
        const vp = engine.getViewport();
        const geoMap = engine.getGeoMap(vp.width || window.innerWidth, vp.height || window.innerHeight);
        const rect = geoMap.get(targetId);
        
        if (rect) {
          finalRatio = direction === 'horizontal' ? pixels / rect.width : pixels / rect.height;
        }
      }
      finalRatio = Math.max(0, Math.min(1, finalRatio));

      // 调用底层引擎原子方法
      engine.splitNode(targetId, direction, finalRatio, newPanel, insertAsSecond);
      return;
    }
  },
};