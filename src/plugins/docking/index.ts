import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import { dockingPanel } from './operators/dockingPanel';
import { dockingGlobal } from './operators/dockingGlobal';
import DockingOverlay from './vue/DockingOverlay.vue';
import type { DockingConfig } from './core';

export class DockingPlugin implements IaiPlugin {
  public name = 'DockingPlugin';
  public overlayComponent = DockingOverlay;
  public config: DockingConfig;

  constructor(config?: DockingConfig) {
    this.config = {
      edgeRatio: 0.3,
      centerRatio: 0.4,
      globalEdgeThreshold: 120,
      dragThreshold: 5,
      ...config,
    };
  }

  install(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
        opPlugin.register(dockingPanel);
        opPlugin.register(dockingGlobal);
    }
  }

  uninstall(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
      opPlugin.unregister('docking.panel');
      opPlugin.unregister('docking.global');
    }
  }
}