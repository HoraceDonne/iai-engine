import type { IaiPlugin } from '../types';
import type { IaiEngine } from '../../core/IaiEngine';
import type { Operator } from './types';
import { panelSplit } from './operators/panelSplit';
import { panelClose } from './operators/panelClose';
import { panelSwitch } from './operators/panelSwitch';
import { panelFloat } from './operators/panelFloat';
import { stashRestore } from './operators/stashRestore';
import { stashPurge } from './operators/stashPurge';
import { panelDestroy } from './operators/panelDestroy';
import { dragStart } from './operators/dragStart';
import { floatMove } from './operators/floatMove';
import { floatResize } from './operators/floatResize';
import { floatClamp } from './operators/floatClamp';
import { floatGetLayer } from './operators/floatGetLayer';
import { floatSetLayer } from './operators/floatSetLayer';
import { floatSetBounds } from './operators/floatSetBounds';
import { splitLineGet } from './operators/splitLineGet';
import { splitLineSetProps } from './operators/splitLineSetProps';
import { floatFocus } from './operators/floatFocus';

export class OperatorPlugin implements IaiPlugin {
  public name = 'OperatorPlugin';
  private engine!: IaiEngine;
  private operators = new Map<string, Operator>();

  constructor() {
    // 注册所有内置操作符
    this.register(panelSplit);
    this.register(panelClose);
    this.register(panelSwitch);
    this.register(panelFloat);
    this.register(stashRestore);
    this.register(stashPurge);
    this.register(panelDestroy);
    this.register(dragStart);
    this.register(floatMove);
    this.register(floatResize);
    this.register(floatClamp);
    this.register(floatGetLayer);
    this.register(floatSetLayer);
    this.register(floatSetBounds);
    this.register(splitLineGet);
    this.register(splitLineSetProps);
    this.register(floatFocus);
  }

  install(engine: IaiEngine) { this.engine = engine; }
  uninstall() { this.operators.clear(); }

  /** 注册新操作符（开发者扩展入口） */
  register(op: Operator) {
    this.operators.set(op.id, op);
  }

  /** 执行操作符 */
  exec(id: string, props: Record<string, any> = {}) {
    const op = this.operators.get(id);
    if (!op) {
      console.warn(`[OperatorPlugin] 未知操作符: ${id}`);
      return undefined;
    }
    return op.execute({ engine: this.engine, props });
  }
}