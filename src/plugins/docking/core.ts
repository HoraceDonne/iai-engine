import type { Rect } from '../../core/types';

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom' | null;

export interface DockingConfig {
  /** 边缘停靠热区占面板宽高的比例，默认 0.3 */
  edgeRatio?: number;
  /** 中心交换热区占面板宽高的比例，默认 0.4 */
  centerRatio?: number;
  /** 全局边缘停靠热区阈值（px），默认 120 */
  globalEdgeThreshold?: number;
  /** 拖拽移动阈值（px），默认 5 */
  dragThreshold?: number;

}

export function calculateDropZone(
  x: number,
  y: number,
  rect: Rect,
  edgeRatio: number = 0.3,
  centerRatio: number = 0.4
): DropZone {
  if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) {
    return null;
  }
  const xRate = (x - rect.x) / rect.width;
  const yRate = (y - rect.y) / rect.height;

  if (
    xRate > edgeRatio && xRate < (1 - edgeRatio) &&
    yRate > edgeRatio && yRate < (1 - edgeRatio)
  ) {
    return 'center';
  }

  const distLeft = xRate;
  const distRight = 1 - xRate;
  const distTop = yRate;
  const distBottom = 1 - yRate;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);
  if (minDist === distTop) return 'top';
  if (minDist === distBottom) return 'bottom';
  if (minDist === distLeft) return 'left';
  return 'right';
}