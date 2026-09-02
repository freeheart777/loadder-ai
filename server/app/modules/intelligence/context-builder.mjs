export class ContextBuilder {
  build({ product, insights = [], memory = [] }) {
    return {
      product,
      insights,
      memory,
      createdAt: new Date().toISOString(),
    };
  }
}
