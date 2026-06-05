import { markRaw } from 'vue';
import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import FloatResizeOverlay from './vue/FloatResizeOverlay.vue';
import type { FloatResizeConfig } from './config';
import { DEFAULT_CONFIG } from './config';

export class FloatResizePlugin implements IaiPlugin {
  public name = 'FloatResizePlugin';
  public overlayComponent = markRaw(FloatResizeOverlay);
  public config: FloatResizeConfig;

  constructor(config?: Partial<FloatResizeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  install(_engine: IaiEngine) {
    // 所有交互逻辑在覆盖层组件中
  }

  uninstall() {
    // 覆盖层随组件销毁自动移除
  }
}