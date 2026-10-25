export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
    return () => this.listeners.get(name)?.delete(callback);
  }
  emit(name, detail = {}) {
    for (const callback of this.listeners.get(name) || []) callback(detail);
  }
}
