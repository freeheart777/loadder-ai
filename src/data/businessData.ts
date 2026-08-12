export type BusinessData = {
  business: {
    name: string;
    industry: string;
    healthScore: number;
    growthReadiness: number;
    riskScore: number;
    dataQuality: number;
  };

  sales: {
    revenue: number;
    revenueLabel: string;
    orders: number;
    conversionRate: number;
    opportunityValue: number;
    opportunityValueLabel: string;
  };

  ecommerce: {
    onlineRevenue: number;
    onlineRevenueLabel: string;

    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;

    averageOrderValue: number;
    averageOrderValueLabel: string;

    checkoutStarted: number;
    abandonedCarts: number;
    abandonedCartRate: number;

    completedPurchases: number;
    checkoutConversionRate: number;

    repeatCustomers: number;
    repeatCustomerRate: number;

    newCustomers: number;

    customerLifetimeValue: number;
    customerLifetimeValueLabel: string;

    refundedOrders: number;
    refundRate: number;
  };

  crm: {
    totalCustomers: number;
    newLeads: number;
    hotLeads: number;
    activeCustomers: number;

    qualifiedLeads: number;
    negotiatingLeads: number;

    buyers: number;
    repeatBuyers: number;

    retentionRate: number;
    churnRate: number;
  };

  website: {
    visits: number;
    uniqueVisitors: number;

    productViews: number;
    addToCart: number;

    leads: number;

    conversionRate: number;
    cartConversionRate: number;
  };

  marketing: {
    adSpend: number;
    adSpendLabel: string;

    roas: number;

    cac: number;
    cacLabel: string;

    reach: number;
    engagementRate: number;

    websiteRevenueFromAds: number;
    websiteRevenueFromAdsLabel: string;
  };

  content: {
    performanceScore: number;
    bestContentType: string;
    topTopic: string;
    conversionRate: number;
  };

  predictive: {
    growthProbability: number;

    predictedRevenue: number;
    predictedRevenueLabel: string;

    predictedCustomers: number;

    predictedConversionRate: number;

    predictedCAC: number;
    predictedCACLabel: string;

    predictedOnlineRevenue: number;
    predictedOnlineRevenueLabel: string;

    predictedRepeatCustomerRate: number;
  };

  goals: {
    primary: string;
    secondary: string[];
  };
};

export const businessData: BusinessData = {
  business: {
    name: "کسب‌وکار من",
    industry: "خدمات و فناوری",
    healthScore: 86,
    growthReadiness: 81,
    riskScore: 18,
    dataQuality: 78,
  },

  sales: {
    revenue: 384000000,
    revenueLabel: "۳۸۴ میلیون تومان",

    orders: 210,

    conversionRate: 6.8,

    opportunityValue: 1200000000,
    opportunityValueLabel: "۱.۲ میلیارد تومان",
  },

  ecommerce: {
    onlineRevenue: 384000000,
    onlineRevenueLabel: "۳۸۴ میلیون تومان",

    totalOrders: 210,
    completedOrders: 186,
    cancelledOrders: 14,

    averageOrderValue: 2064516,
    averageOrderValueLabel: "۲.۰۶ میلیون تومان",

    checkoutStarted: 232,
    abandonedCarts: 46,
    abandonedCartRate: 19.8,

    completedPurchases: 186,
    checkoutConversionRate: 80.2,

    repeatCustomers: 58,
    repeatCustomerRate: 31.2,

    newCustomers: 128,

    customerLifetimeValue: 6700000,
    customerLifetimeValueLabel: "۶.۷ میلیون تومان",

    refundedOrders: 10,
    refundRate: 5.4,
  },

  crm: {
    totalCustomers: 1248,

    newLeads: 213,
    hotLeads: 32,

    activeCustomers: 986,

    qualifiedLeads: 158,
    negotiatingLeads: 92,

    buyers: 186,
    repeatBuyers: 58,

    retentionRate: 72,
    churnRate: 4.5,
  },

  website: {
    visits: 48200,
    uniqueVisitors: 35600,

    productViews: 12740,
    addToCart: 278,

    leads: 213,

    conversionRate: 6.8,
    cartConversionRate: 66.9,
  },

  marketing: {
    adSpend: 120000000,
    adSpendLabel: "۱۲۰ میلیون تومان",

    roas: 4.8,

    cac: 480000,
    cacLabel: "۴۸۰ هزار تومان",

    reach: 248000,
    engagementRate: 6.2,

    websiteRevenueFromAds: 295000000,
    websiteRevenueFromAdsLabel: "۲۹۵ میلیون تومان",
  },

  content: {
    performanceScore: 91,

    bestContentType: "آموزشی",

    topTopic: "هوش مصنوعی",

    conversionRate: 7.2,
  },

  predictive: {
    growthProbability: 82,

    predictedRevenue: 620000000,
    predictedRevenueLabel: "۶۲۰ میلیون تومان",

    predictedCustomers: 150,

    predictedConversionRate: 8.5,

    predictedCAC: 410000,
    predictedCACLabel: "۴۱۰ هزار تومان",

    predictedOnlineRevenue: 510000000,
    predictedOnlineRevenueLabel: "۵۱۰ میلیون تومان",

    predictedRepeatCustomerRate: 38,
  },

  goals: {
    primary: "افزایش فروش",

    secondary: [
      "جذب مشتری",
      "افزایش فروش آنلاین سایت",
      "بهبود نرخ تبدیل",
      "کاهش سبد خرید رهاشده",
      "افزایش خرید مجدد",
      "کاهش هزینه جذب مشتری",
    ],
  },
};