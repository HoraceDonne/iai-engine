// src/plugins/interactive-split/index.ts
import { markRaw } from 'vue';
import type { IaiPlugin } from '../../plugins/types';
import InteractiveSplitOverlay from './vue/InteractiveSplitOverlay.vue';
import { interactiveSplitStart, interactiveSplitCancel } from './operators/interactiveSplit';

export interface InteractiveSplitConfig {
  /** 是否吸附到面板中心 */
  snapToCenter: boolean;
  /** 中心吸附阈值（px） */
  snapThreshold: number;
  /** 取消操作的键盘按键（如 'Escape'），null 禁用 */
  cancelKey: string | null;
  /** 取消操作的鼠标按键（0=左键,2=右键），null 禁用 */
  cancelButton: number | null;
}

const DEFAULT_CONFIG: InteractiveSplitConfig = {
  snapToCenter: true,
  snapThreshold: 15,
  cancelKey: 'Escape',
  cancelButton: 2,
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
      opPlugin.register(interactiveSplitStart);
      opPlugin.register(interactiveSplitCancel);
    } else {
      console.warn('InteractiveSplitPlugin 必须在 OperatorPlugin 之后挂载');
    }
  }

  uninstall(engine: any) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin');
    if (opPlugin) {
      opPlugin.exec('interactive.split.cancel');
      if (typeof opPlugin.unregister === 'function') {
        opPlugin.unregister('interactive.split.start');
        opPlugin.unregister('interactive.split.cancel');
      } else {
        opPlugin.operators?.delete('interactive.split.start');
        opPlugin.operators?.delete('interactive.split.cancel');
      }
    }
    this.engine = null;
  }
}