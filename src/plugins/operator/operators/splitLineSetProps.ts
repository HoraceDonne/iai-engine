import type { Operator } from '../types';

export const splitLineSetProps: Operator = {
  id: 'splitLine.setProps',
  execute({ engine, props }) {
    const { id, resizable, ratio } = props;
    if (!id) return false;

    const root = engine.getRoot();
    if (!root) return false;

    // 深度搜索 SplitNode
    const findSplit = (node: any): any => {
      if (node.id === id && node.type === 'split') return node;
      if (node.children) return findSplit(node.children[0]) || findSplit(node.children[1]);
      return null;
    };

    const splitNode = findSplit(root);
    if (!splitNode) return false;

    const updated = { ...splitNode };
    if (resizable !== undefined) updated.resizable = resizable;
    if (ratio !== undefined) updated.ratio = Math.max(0, Math.min(1, ratio));

    return engine.replace(id, updated);
  },
};