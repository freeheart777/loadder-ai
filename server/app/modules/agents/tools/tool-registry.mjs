export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(name, handler) {
    if (!name || typeof handler !== "function") throw new Error("Invalid tool");
    this.tools.set(name, handler);
  }

  async execute(name, input = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool(input);
  }
}
