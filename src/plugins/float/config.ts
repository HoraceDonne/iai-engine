// 修改后
export interface FloatPluginConfig {
  handleSize: number;
  enableSnap: boolean;
  snapThreshold: number;
  cornerOnly: boolean;
}

export const DEFAULT_FLOAT_CONFIG: FloatPluginConfig = {
  handleSize: 5,
  enableSnap: true,
  snapThreshold: 50,
  cornerOnly: true,
};