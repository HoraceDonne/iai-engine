export class EventBus<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Array<(payload: T[K]) => void> } = {};

  on<K extends keyof T>(event: K, callback: (payload: T[K]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
  }

  off<K extends keyof T>(event: K, callback: (payload: T[K]) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event]!.filter(cb => cb !== callback);
    }
  }

  emit<K extends keyof T>(event: K, payload: T[K]) {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(cb => cb(payload));
    }
  }
}