export interface FloatResizeConfig {
  /** 把手宽度（px） */
  handleSize: number;
  /** 把手颜色 */
  handleColor: string;
  /** 把手悬停颜色 */
  handleHoverColor: string;
  /** 最小调整尺寸（px） */
  minSize: number;
  /** 是否启用智能吸附 */
  enableSnap: boolean;
  /** 吸附阈值（px） */
  snapThreshold: number;
  /** 是否仅右下角三角（关闭八向把手） */
  cornerOnly: boolean;
}

export const DEFAULT_CONFIG: FloatResizeConfig = {
  handleSize: 8,
  handleColor: 'rgba(255, 255, 255, 0.3)',
  handleHoverColor: 'rgba(0, 122, 204, 0.8)',
  minSize: 40,
  enableSnap: false,
  snapThreshold: 8,
  cornerOnly: false,
};