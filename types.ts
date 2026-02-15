export enum ClientType {
  CONTRACTOR = 'Contractor',
  WHOLESALER = 'Wholesaler',
  BRAND = 'Brand Owner',
  RETAILER = 'Retailer',
  UNKNOWN = 'Unknown'
}

export interface LeadProfile {
  companyName: string;
  website: string;
  clientType: ClientType;
  keyContact: {
    name: string;
    role: string;
  };
  contactInfo: {
    email: string;
    phone: string;
  };
  country: string;
  language: string;
  summary: string;
}

export interface BackgroundReport {
  companyName: string;
  overview: string;      // 公司概况
  products: string;      // 核心产品与技术
  marketPosition: string;// 市场地位与竞争
  financialStatus: string; // 经营状况
  riskAssessment: string;// 风险评估
  cooperationSuggestion: string; // 合作建议
}

export interface EmailTemplate {
  subject: string;
  body: string;
  language: string;
  tone: string;
}

export enum AppView {
  LEAD_SCOUT = 'LEAD_SCOUT',
  EMAIL_WRITER = 'EMAIL_WRITER'
}