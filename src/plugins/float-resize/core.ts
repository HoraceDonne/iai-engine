export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

/**
 * 根据拖拽方向和鼠标位移，计算新的面板矩形
 * 纯函数，不依赖任何外部状态
 */
export function computeResizeRect(
  direction: ResizeDirection,
  startRect: { x: number; y: number; width: number; height: number },
  deltaX: number,
  deltaY: number,
  minSize: number
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = startRect;

  if (direction.includes('e')) {
    width = Math.max(minSize, startRect.width + deltaX);
  }
  if (direction.includes('s')) {
    height = Math.max(minSize, startRect.height + deltaY);
  }
  if (direction.includes('w')) {
    const newWidth = Math.max(minSize, startRect.width - deltaX);
    x = startRect.x + (startRect.width - newWidth);
    width = newWidth;
  }
  if (direction.includes('n')) {
    const newHeight = Math.max(minSize, startRect.height - deltaY);
    y = startRect.y + (startRect.height - newHeight);
    height = newHeight;
  }

  return { x, y, width, height };
}