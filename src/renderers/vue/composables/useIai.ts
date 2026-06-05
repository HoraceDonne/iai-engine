import { inject, type InjectionKey } from 'vue';
import type { IaiEngine } from '../../../core/IaiEngine';

export const ENGINE_KEY: InjectionKey<IaiEngine> = Symbol('IAI_ENGINE');

export function useEngine(): IaiEngine {
  const engine = inject(ENGINE_KEY);
  if (!engine) {
    throw new Error('[IaiEngine] useEngine 必须在 IaiLayout 内部使用');
  }
  return engine;
}