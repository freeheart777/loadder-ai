export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);

    return () => {
      this.listeners.set(
        type,
        (this.listeners.get(type) || []).filter((item) => item !== handler)
      );
    };
  }

  async publish(event) {
    const handlers = this.listeners.get(event.type) || [];
    for (const handler of handlers) {
      await handler(event);
    }
    return event;
  }
}
