import type { IaiEngine } from '../core/IaiEngine';

export interface IaiPlugin {
  name: string;
  install(engine: IaiEngine): void;

  /** 可选：卸载时调用，用于清理事件、移除钩子等 */
  uninstall?(engine: IaiEngine): void;
}