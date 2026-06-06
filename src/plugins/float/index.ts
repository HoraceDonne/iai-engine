// 修改后
import { markRaw, reactive } from 'vue';
import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import FloatOverlay from './vue/FloatOverlay.vue';                      // 组件名更新
import { type FloatPluginConfig, DEFAULT_FLOAT_CONFIG } from './config'; // 配置类型/默认值更新
import { floatMoveStart } from './operators/floatMoveStartV2';        // 使用新操作符
// 如果还有旧操作符 floatMoveDrag，建议删除

export class FloatPlugin implements IaiPlugin {
  public name = 'FloatPlugin';
  public overlayComponent = markRaw(FloatOverlay);
  public config: FloatPluginConfig;

  constructor(config?: Partial<FloatPluginConfig>) {
    this.config = reactive({ ...DEFAULT_FLOAT_CONFIG, ...config });
  }

  install(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
      opPlugin.register(floatMoveStart);
    }
  }

  uninstall(engine: IaiEngine) {
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    if (opPlugin) {
      opPlugin.unregister('float.move.start');
    }
  }
}