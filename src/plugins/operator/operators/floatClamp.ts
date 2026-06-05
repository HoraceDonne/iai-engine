// src/plugins/operator/operators/floatClamp.ts
import type { Operator } from '../types';
import { resolveConstraint } from '../../../core/constraint';

export const floatClamp: Operator = {
  id: 'float.clamp',
  execute({ engine, props }) {
    const { target } = props;
    const viewport = engine.getViewport();
    const boundary = {
      x: 0,
      y: 0,
      width: viewport.width || window.innerWidth,
      height: viewport.height || window.innerHeight,
    };

    const clampPanel = (id: string) => {
      const fp = engine.getFree(id);
      if (!fp) return;

      const metaGuides = fp.panel?.meta?.guides;
      const guides = props.offsets || metaGuides || { top: 0, bottom: 0, left: 0, right: 0 };
      const offsets = {
        top: guides.top ?? 0,
        bottom: guides.bottom ?? 0,
        left: guides.left ?? 0,
        right: guides.right ?? 0,
      };

      const result = resolveConstraint({
        rect: { x: fp.x, y: fp.y, width: fp.width, height: fp.height },
        boundary,
        offsets,
      });

      engine.updateFree(id, { x: result.x, y: result.y });
    };

    if (target) {
      clampPanel(target);
    } else {
      for (const fp of engine.getAllFree()) {
        clampPanel(fp.id);
      }
    }
  },
};