import { reactive } from 'vue';

export const dockingState = reactive<{
  targetId: string | null;
  zone: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
}>({
  targetId: null,
  zone: null,
  rect: null,
});