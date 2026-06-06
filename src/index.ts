// src/index.ts —— Iai 布局引擎统一入口

// 核心引擎
export { IaiEngine } from './core/IaiEngine';

// 约束求解器（供高级用户直接使用）
export { resolveConstraint, clampResize } from './core/constraint';

// 渲染适配器 (Vue)
export { default as IaiLayout } from './renderers/vue/components/IaiLayout.vue';
export { useEngine, ENGINE_KEY } from './renderers/vue/composables/useIai';

// 🌟 插件统一导出（直接重导出汇总模块）
export * from './plugins/index';

// 类型导出
export type * from './core/types';