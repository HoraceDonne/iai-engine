// src/plugins/docking/index.ts
import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import { dockingPanel } from './operators/dockingPanel';
import { dockingGlobal } from './operators/dockingGlobal';
import DockingOverlay from './vue/DockingOverlay.vue';

export class DockingPlugin implements IaiPlugin {
  public name = 'DockingPlugin';
  public overlayComponent = DockingOverlay;

    install(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
        opPlugin.register(dockingPanel);
        opPlugin.register(dockingGlobal);
    }
    }

    uninstall(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find(p => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
        opPlugin.unregister('docking.panel');
        opPlugin.unregister('docking.global');
    }
    }
}