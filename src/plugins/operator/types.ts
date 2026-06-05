import type { IaiEngine } from '../../core/IaiEngine';

export interface OperatorPropsSchemaItem {
  type: 'string' | 'number' | 'select' | 'boolean';
  label: string;
  default?: any;
  options?: string[];      // type=select 时的选项
  required?: boolean;
  description?: string;    // 帮助文本
}

export interface Operator {
  id: string;
  execute: (ctx: OperatorContext) => any; // 允许返回值
  description?: string;
  propsSchema?: Record<string, OperatorPropsSchemaItem>;
}

export interface OperatorContext {
  engine: IaiEngine;
  props: Record<string, any>;
}