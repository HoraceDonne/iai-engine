// src/core/constraint.ts
import type { Rect } from './types';

// ═══════════════════════════════════════
// 通用类型
// ═══════════════════════════════════════

export interface ConstraintOffsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ═══════════════════════════════════════
// 平移约束求解器
// ═══════════════════════════════════════

export interface ResolveConstraintConfig {
  rect: Rect;
  boundary: Rect;
  offsets: ConstraintOffsets;
}

/**
 * 平移模式：保持面板尺寸不变，只通过平移来满足四参考线约束
 * 适用场景：拖拽移动悬浮窗
 */
export function resolveConstraint({
  rect,
  boundary,
  offsets,
}: ResolveConstraintConfig): Rect {
  let { x, y, width, height } = rect;

  // X 轴独立求解
  const minX = boundary.x - offsets.left;
  const maxX = boundary.x + boundary.width - width + offsets.right;
  let targetX = x;
  if (minX > maxX) {
    targetX = minX;
  } else {
    targetX = Math.max(minX, Math.min(maxX, targetX));
  }

  // Y 轴独立求解
  const minY = boundary.y - offsets.top;
  const maxY = boundary.y + boundary.height - height + offsets.bottom;
  let targetY = y;
  if (minY > maxY) {
    targetY = minY;
  } else {
    targetY = Math.max(minY, Math.min(maxY, targetY));
  }

  return { x: targetX, y: targetY, width, height };
}

// ═══════════════════════════════════════
// 缩放约束求解器（锚点驱动）
// ═══════════════════════════════════════

export interface ClampResizeConfig {
  startRect: Rect;
  boundary: Rect;
  offsets: ConstraintOffsets;
  handle: ResizeHandle;
  deltaX: number;
  deltaY: number;
  minWidth?: number;
  minHeight?: number;
}

/**
 * 缩放模式：锚点固定，通过限制尺寸变化来满足四参考线约束
 * 适用场景：拖拽把手调整悬浮窗大小
 */
export function clampResize({
  startRect,
  boundary,
  offsets,
  handle,
  deltaX,
  deltaY,
  minWidth = 40,
  minHeight = 40,
}: ClampResizeConfig): Rect {
  let targetX = startRect.x;
  let targetY = startRect.y;
  let targetW = startRect.width;
  let targetH = startRect.height;

  const limitLeft = boundary.x - offsets.left;
  const limitRight = boundary.x + boundary.width + offsets.right;
  const limitTop = boundary.y - offsets.top;
  const limitBottom = boundary.y + boundary.height + offsets.bottom;

  // X 轴
  if (handle.includes('e')) {
    let newW = startRect.width + deltaX;
    const maxW = limitRight - startRect.x;
    targetW = Math.max(minWidth, Math.min(newW, maxW));
  } else if (handle.includes('w')) {
    const rightAnchor = startRect.x + startRect.width;
    let newX = startRect.x + deltaX;
    const maxX = rightAnchor - minWidth;
    targetX = Math.max(limitLeft, Math.min(newX, maxX));
    targetW = rightAnchor - targetX;
  }

  // Y 轴
  if (handle.includes('s')) {
    let newH = startRect.height + deltaY;
    const maxH = limitBottom - startRect.y;
    targetH = Math.max(minHeight, Math.min(newH, maxH));
  } else if (handle.includes('n')) {
    const bottomAnchor = startRect.y + startRect.height;
    let newY = startRect.y + deltaY;
    const maxY = bottomAnchor - minHeight;
    targetY = Math.max(limitTop, Math.min(newY, maxY));
    targetH = bottomAnchor - targetY;
  }

  return { x: targetX, y: targetY, width: targetW, height: targetH };
}