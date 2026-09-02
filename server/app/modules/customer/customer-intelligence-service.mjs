export class CustomerIntelligenceService {
  score(customer = {}) {
    let score = 0;
    if ((customer.ordersCount || 0) > 3) score += 30;
    if ((customer.totalSpent || 0) > 1000000) score += 40;
    if ((customer.lastPurchaseDays || 999) < 30) score += 30;
    return score;
  }

  segment(customer = {}) {
    const score = this.score(customer);
    if (score >= 80) return "VIP";
    if (score >= 50) return "LOYAL";
    return "NEW";
  }
}
