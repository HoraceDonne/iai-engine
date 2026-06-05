import type { Operator } from '../types';

export const splitLineGet: Operator = {
  id: 'splitLine.get',
  execute({ engine, props }) {
    const { id } = props;
    const root = engine.getRoot();
    if (!root) return id ? null : [];

    const collectAllSplits = (node: any): any[] => {
      if (node.type === 'split') {
        return [node, ...collectAllSplits(node.children[0]), ...collectAllSplits(node.children[1])];
      }
      if (node.children) {
        return [...collectAllSplits(node.children[0]), ...collectAllSplits(node.children[1])];
      }
      return [];
    };

    // 不传 id → 返回所有分割线列表
    if (!id) {
      return collectAllSplits(root).map(s => ({
        id: s.id,
        direction: s.direction,
        ratio: s.ratio,
        resizable: s.resizable !== false,
      }));
    }

    // 传 id → 返回单个分割线属性
    const findSplit = (node: any): any => {
      if (node.id === id && node.type === 'split') return node;
      if (node.children) return findSplit(node.children[0]) || findSplit(node.children[1]);
      return null;
    };

    const splitNode = findSplit(root);
    if (!splitNode) return null;

    return {
      id: splitNode.id,
      direction: splitNode.direction,
      ratio: splitNode.ratio,
      resizable: splitNode.resizable !== false,
      children: splitNode.children.map((c: any) => ({ id: c.id, type: c.type })),
    };
  },
};