// src/plugins/domino/index.ts
import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import DominoOverlay from './vue/DominoOverlay.vue';
import type { DominoConfig } from './core';

export class DominoPlugin implements IaiPlugin {
  public name = 'DominoPlugin';
  public overlayComponent = DominoOverlay;
  public config: DominoConfig;

  constructor(config?: Partial<DominoConfig>) {
    this.config = {
      fpsLimit: 60,
      deadzone: 1.5,
      clampToViewport: true,
      rigidClamp: true,
      zIndexBase: 10,
      ...config,
    };
  }

  install(_engine: IaiEngine) {
    // 所有逻辑在 overlay 组件中
  }

  uninstall() {
    // 清理由 overlay 组件的 onUnmounted 处理
  }
}