export class CustomerSegmentEngine {
  segment(customer = {}) {
    if ((customer.totalSpent || 0) > 10000000) return "vip";
    if ((customer.ordersCount || 0) > 2) return "loyal";
    return "new";
  }
}
