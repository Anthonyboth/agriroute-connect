// ============================================
// TIPOS DE RELATÓRIOS - CONTRATOS TYPESCRIPT
// ============================================

// ==========================================
// TIPOS COMUNS
// ==========================================

export interface DateRange {
  from: Date;
  to: Date;
}

export type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface MonthlyDataPoint {
  month: string;
  [key: string]: string | number;
}

export interface RouteData {
  origin: string;
  destination: string;
  count: number;
  total_revenue?: number;
  total_value?: number;
}

export interface DriverRankingData {
  driver_name: string;
  trips: number;
  avg_rating: number;
  total_spent: number;
}

export interface ProviderRankingData {
  provider_name: string;
  services: number;
  avg_rating: number;
  total_spent: number;
}

// ==========================================
// PRODUTOR - RELATÓRIOS
// ==========================================

export interface ProducerFreightsSummary {
  total: number;
  pending: number;
  in_transit: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  avg_price: number;
  avg_distance_km: number;
  total_distance_km: number;
}

export interface ProducerServicesSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  avg_price: number;
}

export interface ProducerReportSummary {
  freights: ProducerFreightsSummary;
  services: ProducerServicesSummary;
  avg_completion_time_hours: number;
}

export interface ProducerSpendingByMonth {
  month: string;
  freight_spending: number;
  service_spending: number;
}

export interface ProducerReportCharts {
  spending_by_month: ProducerSpendingByMonth[];
  by_status: ChartDataPoint[];
  by_cargo_type: Array<ChartDataPoint & { total_value: number }>;
  top_drivers: DriverRankingData[];
  top_providers: ProviderRankingData[];
  top_routes: RouteData[];
}

// ==========================================
// MOTORISTA - RELATÓRIOS
// ==========================================

export interface DriverFreightsSummary {
  total: number;
  accepted: number;
  completed: number;
  in_transit: number;
  cancelled: number;
  total_revenue: number;
  avg_revenue: number;
}

export interface DriverDistanceSummary {
  total_km: number;
  avg_per_freight: number;
}

export interface RatingsSummary {
  average: number;
  total: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export interface DriverExpensesSummary {
  total: number;
  fuel: number;
  maintenance: number;
  toll: number;
  tire: number;
  other: number;
}

export interface DriverReportSummary {
  freights: DriverFreightsSummary;
  distance: DriverDistanceSummary;
  ratings: RatingsSummary;
  expenses: DriverExpensesSummary;
}

export interface DriverRevenueByMonth {
  month: string;
  freights: number;
  revenue: number;
  km: number;
}

export interface RatingsTrend {
  month: string;
  avg_rating: number;
  count: number;
}

export interface StateData {
  state: string;
  count: number;
}

export interface DriverReportCharts {
  revenue_by_month: DriverRevenueByMonth[];
  by_status: ChartDataPoint[];
  by_cargo_type: ChartDataPoint[];
  expenses_by_type: ChartDataPoint[];
  ratings_trend: RatingsTrend[];
  top_routes: RouteData[];
  top_states: StateData[];
}

// ==========================================
// PRESTADOR DE SERVIÇOS - RELATÓRIOS
// ==========================================

export interface ProviderServicesSummary {
  total: number;
  pending: number;
  accepted: number;
  completed: number;
  cancelled: number;
  in_progress: number;
  total_revenue: number;
  avg_revenue: number;
}

export interface ProviderReportSummary {
  services: ProviderServicesSummary;
  ratings: RatingsSummary;
  conversion_rate: number;
  avg_service_time_hours: number;
}

export interface ProviderRevenueByMonth {
  month: string;
  services: number;
  revenue: number;
}

export interface DayOfWeekData {
  day_num: number;
  day_name: string;
  count: number;
}

export interface CategoryData {
  name: string;
  value: number;
  revenue: number;
}

export interface EmergencyVsRegular {
  emergency: number;
  regular: number;
}

export interface ProviderReportCharts {
  revenue_by_month: ProviderRevenueByMonth[];
  by_status: ChartDataPoint[];
  by_category: CategoryData[];
  ratings_trend: RatingsTrend[];
  by_day_of_week: DayOfWeekData[];
  emergency_vs_regular: EmergencyVsRegular;
}

// ==========================================
// TRANSPORTADORA - RELATÓRIOS
// ==========================================

export interface CompanyFreightsSummary {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  total_revenue: number;
  avg_revenue: number;
}

export interface CompanyDriversSummary {
  total: number;
  active: number;
  own: number;
  third_party: number;
}

export interface CompanyVehiclesSummary {
  total: number;
  active: number;
}

export interface CompanyReportSummary {
  freights: CompanyFreightsSummary;
  drivers: CompanyDriversSummary;
  vehicles: CompanyVehiclesSummary;
  delay_rate: number;
  cancellation_rate: number;
}

export interface CompanyRevenueByMonth {
  month: string;
  freights: number;
  revenue: number;
}

export interface DriverPerformanceData {
  driver_name: string;
  freights: number;
  completed: number;
  revenue: number;
  avg_rating: number;
}

export interface OwnVsThirdParty {
  own: number;
  third_party: number;
}

export interface CompanyReportCharts {
  revenue_by_month: CompanyRevenueByMonth[];
  by_status: ChartDataPoint[];
  by_cargo_type: ChartDataPoint[];
  drivers_performance: DriverPerformanceData[];
  own_vs_third_party: OwnVsThirdParty;
}

// ==========================================
// TIPOS DE EXPORTAÇÃO
// ==========================================

export type ExportFormat = 'pdf' | 'excel';

export interface ExportOptions {
  format: ExportFormat;
  title: string;
  dateRange: DateRange;
}

// ==========================================
// TIPOS DE FEATURE PREMIUM
// ==========================================

export interface PremiumFeatures {
  periodComparison: boolean;
  automaticInsights: boolean;
  unlimitedExports: boolean;
  fullHistory: boolean;
}

export const FREE_FEATURES: PremiumFeatures = {
  periodComparison: false,
  automaticInsights: false,
  unlimitedExports: false,
  fullHistory: false,
};

export const PREMIUM_FEATURES: PremiumFeatures = {
  periodComparison: true,
  automaticInsights: true,
  unlimitedExports: true,
  fullHistory: true,
};
