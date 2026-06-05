import type { Rect } from '../../core/types';

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom' | null;

/**
 * 计算鼠标在目标面板内的五宫格停靠区域
 */
export function calculateDropZone(x: number, y: number, rect: Rect): DropZone {
  if (x < rect.x || x > rect.x + rect.width || y < rect.y || y > rect.y + rect.height) {
    return null;
  }
  const xRate = (x - rect.x) / rect.width;
  const yRate = (y - rect.y) / rect.height;

  if (xRate > 0.3 && xRate < 0.7 && yRate > 0.3 && yRate < 0.7) return 'center';

  const min = Math.min(yRate, 1 - yRate, xRate, 1 - xRate);
  if (min === yRate) return 'top';
  if (min === 1 - yRate) return 'bottom';
  if (min === xRate) return 'left';
  return 'right';
}