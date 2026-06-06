// src/plugins/float/operators/floatMoveStartV2.ts
import type { Operator } from '../../operator/types';
import { resolveConstraint } from '../../../core/constraint';
import type { FloatPlugin } from '../index';

/**
 * 悬浮窗移动操作符（v2）
 * - 使用通用拖拽基础设施（drag.start / drag.move / drag.end）
 * - 支持吸附开关（通过 FloatPlugin 配置 enableSnap）
 * - 仅对悬浮窗生效
 *
 * 用法：operator.exec('float.move.start.v2', { sourceId, event })
 */
export const floatMoveStart: Operator = {
  id: 'float.move.start',
  execute({ engine, props }) {
    const { sourceId, event } = props;
    if (!sourceId || !event) return;

    // 1. 仅悬浮窗可移动
    const fp = engine.getFree(sourceId);
    if (!fp) {
      console.warn('[float.move] 面板不是悬浮窗，无法移动');
      return;
    }

    // 2. 获取 FloatPlugin 配置（吸附开关等）
    const plugin = engine.getPlugins().find((p: any) => p.name === 'FloatPlugin') as FloatPlugin | undefined;
    const config = plugin?.config ?? { enableSnap: true, snapThreshold: 8 };

    // 3. 置顶并聚焦
    engine.focus(sourceId);
    const allFree = engine.getAllFree();
    const maxZ = allFree.reduce((max, f) => Math.max(max, f.zIndex), 0);
    engine.updateFree(sourceId, { zIndex: maxZ + 1 });

    // 4. 记录起始状态（悬浮窗位置、尺寸、参考线）
    const startX = fp.x;
    const startY = fp.y;
    const width = fp.width;
    const height = fp.height;
    const guides = fp.panel?.meta?.guides || { top: 0, bottom: 0, left: 0, right: 0 };

    // 5. 启动通用拖拽事件流（内部会处理阈值判定）
    const opPlugin = engine.getPlugins().find((p: any) => p.name === 'OperatorPlugin') as any;
    opPlugin.exec('drag.start', {
      sourceId,
      initialX: event.clientX,
      initialY: event.clientY,
      threshold: 5,          // 移动 5px 后才开始拖拽
      detectHover: false,    // 不需要检测悬停
    });

    // 6. 处理拖拽移动
    const onMove = (data: any) => {
      if (data.sourceId !== sourceId) return;

      // 计算视口边界
      const vp = engine.getViewport();
      const boundary = {
        x: 0,
        y: 0,
        width: vp.width || window.innerWidth,
        height: vp.height || window.innerHeight,
      };

      // 基础位置（起始 + 位移增量）
      let targetX = startX + data.deltaX;
      let targetY = startY + data.deltaY;

      // 基础物理约束（绝不越界，包含安全参考线）
      const clamped = resolveConstraint({
        rect: { x: targetX, y: targetY, width, height },
        boundary,
        offsets: guides,
      });
      targetX = clamped.x;
      targetY = clamped.y;

      // 智能吸附（如果启用）
      if (config.enableSnap) {
        const threshold = config.snapThreshold ?? 8;
        const wallLeft = boundary.x + (guides.left || 0);
        const wallRight = boundary.x + boundary.width - (guides.right || 0);
        const wallTop = boundary.y + (guides.top || 0);
        const wallBottom = boundary.y + boundary.height - (guides.bottom || 0);

        // X 轴吸附
        if (Math.abs(targetX - wallLeft) <= threshold) {
          targetX = wallLeft;
        } else if (Math.abs(targetX + width - wallRight) <= threshold) {
          targetX = wallRight - width;
        }

        // Y 轴吸附
        if (Math.abs(targetY - wallTop) <= threshold) {
          targetY = wallTop;
        } else if (Math.abs(targetY + height - wallBottom) <= threshold) {
          targetY = wallBottom - height;
        }
      }

      // 更新位置
      engine.updateFree(sourceId, { x: targetX, y: targetY });
    };

    // 7. 拖拽结束时清理，并做最终约束兜底
    const onEnd = () => {
      opPlugin.exec('float.clamp', { target: sourceId });
      engine.events.off('drag:move', onMove);
      engine.events.off('drag:end', onEnd);
    };

    engine.events.on('drag:move', onMove);
    engine.events.on('drag:end', onEnd);
  },
};