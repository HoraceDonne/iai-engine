// src/plugins/float-resize/core.ts
import { clampResize } from '../../core/constraint';
import type { Rect } from '../../core/types';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface SnappedResizeOptions {
  startRect: Rect;
  boundary: Rect;
  guides: { top?: number; bottom?: number; left?: number; right?: number };
  handle: ResizeDirection;
  deltaX: number;
  deltaY: number;
  minSize: number;
  enableSnap: boolean;
  snapThreshold: number;
}

/**
 * 🌟 核心算法：计算悬浮窗在调整大小时的最终矩形（包含基础约束与边缘智能吸附）
 * 这是一个纯函数，不依赖任何 Vue 或 DOM 状态。
 */
export function calculateSnappedResizeRect(options: SnappedResizeOptions): Rect {
  const { startRect, boundary, guides, handle, deltaX, deltaY, minSize, enableSnap, snapThreshold } = options;

  // 1. 调用引擎底层的钳制约束，得出绝不越界、绝不小于 minSize 的基础安全矩形
  const newRect = clampResize({
    startRect,
    boundary,
    offsets: {
      top: guides.top || 0,
      bottom: guides.bottom || 0,
      left: guides.left || 0,
      right: guides.right || 0,
    },
    handle,
    deltaX,
    deltaY,
    minWidth: minSize,
    minHeight: minSize,
  });

  // 2. 如果没有开启智能吸附，直接返回基础矩形
  if (!enableSnap) {
    return newRect;
  }

  // 3. 智能边缘磁吸 (Magnetic Snap)
  // 计算带有安全区(guides)的绝对物理墙壁坐标
  const wallLeft = boundary.x + (guides.left || 0);
  const wallRight = boundary.x + boundary.width - (guides.right || 0);
  const wallTop = boundary.y + (guides.top || 0);
  const wallBottom = boundary.y + boundary.height - (guides.bottom || 0);

  // --- 横向 X 轴吸附 ---
  if (handle.includes('e')) {
    const rightEdge = newRect.x + newRect.width;
    if (Math.abs(wallRight - rightEdge) <= snapThreshold) {
      const snappedWidth = wallRight - newRect.x;
      if (snappedWidth >= minSize) newRect.width = snappedWidth;
    }
  } else if (handle.includes('w')) {
    if (Math.abs(newRect.x - wallLeft) <= snapThreshold) {
      const snappedWidth = newRect.width + (newRect.x - wallLeft);
      if (snappedWidth >= minSize) {
        newRect.width = snappedWidth;
        newRect.x = wallLeft;
      }
    }
  }

  // --- 纵向 Y 轴吸附 ---
  if (handle.includes('s')) {
    const bottomEdge = newRect.y + newRect.height;
    if (Math.abs(wallBottom - bottomEdge) <= snapThreshold) {
      const snappedHeight = wallBottom - newRect.y;
      if (snappedHeight >= minSize) newRect.height = snappedHeight;
    }
  } else if (handle.includes('n')) {
    if (Math.abs(newRect.y - wallTop) <= snapThreshold) {
      const snappedHeight = newRect.height + (newRect.y - wallTop);
      if (snappedHeight >= minSize) {
        newRect.height = snappedHeight;
        newRect.y = wallTop;
      }
    }
  }

  return newRect;
}