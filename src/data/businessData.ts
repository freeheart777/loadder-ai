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

  crm: {
    totalCustomers: number;
    newLeads: number;
    hotLeads: number;
    activeCustomers: number;
    retentionRate: number;
    churnRate: number;
  };

  marketing: {
    adSpend: number;
    adSpendLabel: string;
    roas: number;
    cac: number;
    cacLabel: string;
    reach: number;
    engagementRate: number;
  };

  content: {
    performanceScore: number;
    bestContentType: string;
    topTopic: string;
    conversionRate: number;
  };

  website: {
    visits: number;
    leads: number;
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

  crm: {
    totalCustomers: 1248,
    newLeads: 213,
    hotLeads: 32,
    activeCustomers: 986,
    retentionRate: 72,
    churnRate: 4.5,
  },

  marketing: {
    adSpend: 120000000,
    adSpendLabel: "۱۲۰ میلیون تومان",
    roas: 4.8,
    cac: 480000,
    cacLabel: "۴۸۰ هزار تومان",
    reach: 248000,
    engagementRate: 6.2,
  },

  content: {
    performanceScore: 91,
    bestContentType: "آموزشی",
    topTopic: "هوش مصنوعی",
    conversionRate: 7.2,
  },

  website: {
    visits: 48200,
    leads: 213,
    conversionRate: 6.8,
  },

  predictive: {
    growthProbability: 82,
    predictedRevenue: 620000000,
    predictedRevenueLabel: "۶۲۰ میلیون تومان",
    predictedCustomers: 150,
    predictedConversionRate: 8.5,
    predictedCAC: 410000,
    predictedCACLabel: "۴۱۰ هزار تومان",
  },

  goals: {
    primary: "افزایش فروش",
    secondary: [
      "جذب مشتری",
      "بهبود نرخ تبدیل",
      "کاهش هزینه جذب مشتری",
    ],
  },
};