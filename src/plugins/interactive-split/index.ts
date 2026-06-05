// src/plugins/interactive-split/index.ts
import { markRaw } from 'vue';
import type { IaiPlugin } from '../../plugins/types';
import InteractiveSplitOverlay from './vue/InteractiveSplitOverlay.vue';
import { interactiveSplitStart, interactiveSplitCancel } from './operators/interactiveSplit';

export interface InteractiveSplitConfig {
  lineWidth: number;
  lineColor: string;
  snapToCenter: boolean;
  snapThreshold: number;
  snapColor: string;
  cursor: string;
}

const DEFAULT_CONFIG: InteractiveSplitConfig = {
  lineWidth: 2,
  lineColor: '#007fd4',
  snapToCenter: true,
  snapThreshold: 15,
  snapColor: '#00ff88',
  cursor: 'crosshair',
};

export class InteractiveSplitPlugin implements IaiPlugin {
  public name = 'InteractiveSplitPlugin';
  public overlayComponent = markRaw(InteractiveSplitOverlay);
  public config: InteractiveSplitConfig;
  private engine: any = null;

  constructor(config?: Partial<InteractiveSplitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  install(engine: any) {
    this.engine = engine;
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin');
    
    if (opPlugin) {
      // 注册操作符
      opPlugin.register(interactiveSplitStart);
      opPlugin.register(interactiveSplitCancel);
    } else {
      console.warn('InteractiveSplitPlugin 必须在 OperatorPlugin 之后挂载');
    }
  }

  // 🌟 新增：严谨的卸载逻辑
  uninstall(engine: any) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin');
    
    if (opPlugin) {
      // 1. 强制终止可能正在进行的切割交互，清理内存和 DOM 事件
      opPlugin.exec('interactive.split.cancel');
      
      // 2. 从操作符中心注销（假设你的 OperatorPlugin 提供了 unregister，如果没有，可以操作内部 Map）
      if (typeof opPlugin.unregister === 'function') {
        opPlugin.unregister('interactive.split.start');
        opPlugin.unregister('interactive.split.cancel');
      } else {
        // 如果没有提供 unregister，手动清理
        opPlugin.operators?.delete('interactive.split.start');
        opPlugin.operators?.delete('interactive.split.cancel');
      }
    }
    this.engine = null;
  }
}