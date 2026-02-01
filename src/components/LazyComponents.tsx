// Lazy loaded components for better performance
import { Suspense, ComponentType } from 'react';
import { AppLoader, SectionLoader } from '@/components/AppLoader';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

// ============= Utility Component for Loading States =============
// ✅ REFACTORED: Agora usa o componente unificado AppLoader
export const ComponentLoader = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  return <AppLoader variant="inline" size={size} />;
};

// ✅ Alias para uso em Suspense de seções
export { SectionLoader };

// ============= Skeleton Loaders =============
export const CardSkeleton = () => (
  <div className="rounded-lg border bg-card p-4 animate-pulse">
    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
    <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-muted rounded w-2/3"></div>
  </div>
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 bg-muted rounded"></div>
    ))}
  </div>
);

// ============= Lazy Wrapper with Error Handling =============
export function withLazySuspense<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback: React.ReactNode = <ComponentLoader />
) {
  const LazyComponent = lazyWithRetry(importFn);
  
  return function WrappedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// ============= Dashboard Components =============
export const DriverDashboard = lazyWithRetry(() => import('@/pages/DriverDashboard'));
export const ProducerDashboard = lazyWithRetry(() => import('@/pages/ProducerDashboard'));
export const AdminPanel = lazyWithRetry(() => import('@/pages/AdminPanel'));
export const ServiceProviderDashboard = lazyWithRetry(() => import('@/pages/ServiceProviderDashboard'));
export const CompanyDashboard = lazyWithRetry(() => import('@/pages/CompanyDashboard'));
export const NfeDashboard = lazyWithRetry(() => import('@/pages/NfeDashboard'));

// ============= Modal Components =============
export const AuthModal = lazyWithRetry(() => import('@/components/AuthModal'));
export const FreightDetails = lazyWithRetry(() => import('@/components/FreightDetails').then(module => ({ default: module.FreightDetails })));
export const UserProfileModal = lazyWithRetry(() => import('@/components/UserProfileModal').then(module => ({ default: module.UserProfileModal })));
export const NotificationCenter = lazyWithRetry(() => import('@/components/NotificationCenter').then(module => ({ default: module.NotificationCenter })));

// ============= Heavy Components (Charts, Maps, etc) =============
export const GoogleMap = lazyWithRetry(() => import('@/components/map/MapLibreMap'));
export const SmartFreightMatcher = lazyWithRetry(() => import('@/components/SmartFreightMatcher').then(m => ({ default: m.SmartFreightMatcher })));
export const AdvancedFreightSearch = lazyWithRetry(() => import('@/components/AdvancedFreightSearch').then(m => ({ default: m.AdvancedFreightSearch })));
export const VehicleManager = lazyWithRetry(() => import('@/components/VehicleManager').then(m => ({ default: m.VehicleManager })));
export const DriverAvailabilityCalendar = lazyWithRetry(() => import('@/components/DriverAvailabilityCalendar').then(m => ({ default: m.DriverAvailabilityCalendar })));
export const ScheduledFreightsManager = lazyWithRetry(() => import('@/components/ScheduledFreightsManager').then(m => ({ default: m.ScheduledFreightsManager })));
export const ServiceTypeManager = lazyWithRetry(() => import('@/components/ServiceTypeManager').then(m => ({ default: m.ServiceTypeManager })));
export const MatchIntelligentDemo = lazyWithRetry(() => import('@/components/MatchIntelligentDemo').then(m => ({ default: m.MatchIntelligentDemo })));
export const UserCityManager = lazyWithRetry(() => import('@/components/UserCityManager').then(m => ({ default: m.UserCityManager })));
export const DriverAvailabilityAreasManager = lazyWithRetry(() => import('@/components/DriverAvailabilityAreasManager').then(m => ({ default: m.DriverAvailabilityAreasManager })));
export const DriverRegionManager = lazyWithRetry(() => import('@/components/DriverRegionManager').then(m => ({ default: m.DriverRegionManager })));
export const UnifiedLocationManager = lazyWithRetry(() => import('@/components/UnifiedLocationManager'));
export const DriverPayouts = lazyWithRetry(() => import('@/components/DriverPayouts').then(m => ({ default: m.DriverPayouts })));
export const UnifiedHistory = lazyWithRetry(() => import('@/components/UnifiedHistory').then(m => ({ default: m.UnifiedHistory })));
export const PendingRatingsPanel = lazyWithRetry(() => import('@/components/PendingRatingsPanel').then(m => ({ default: m.PendingRatingsPanel })));
export const DriverAutoLocationTracking = lazyWithRetry(() => import('@/components/DriverAutoLocationTracking').then(m => ({ default: m.DriverAutoLocationTracking })));
export const PlatformStatsSection = lazyWithRetry(() => import('@/components/PlatformStatsSection').then(m => ({ default: m.PlatformStatsSection })));

// ============= Fiscal Components (Heavy) =============
export const FiscalOnboardingWizard = lazyWithRetry(() => import('@/components/fiscal/FiscalOnboardingWizard').then(m => ({ default: m.FiscalOnboardingWizard })));
export const CertificateUploadDialog = lazyWithRetry(() => import('@/components/fiscal/CertificateUploadDialog').then(m => ({ default: m.CertificateUploadDialog })));
export const ComplianceDashboard = lazyWithRetry(() => import('@/components/fiscal/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard })));

// ============= Report Components (Recharts - Heavy) =============
export const FreightAnalyticsDashboard = lazyWithRetry(() => import('@/components/FreightAnalyticsDashboard').then(m => ({ default: m.FreightAnalyticsDashboard })));
export const CompanyAnalyticsDashboard = lazyWithRetry(() => import('@/components/CompanyAnalyticsDashboard').then(m => ({ default: m.CompanyAnalyticsDashboard })));
export const PeriodComparisonDashboard = lazyWithRetry(() => import('@/components/PeriodComparisonDashboard').then(m => ({ default: m.PeriodComparisonDashboard })));
export const ServiceProviderReportsDashboard = lazyWithRetry(() => import('@/components/ServiceProviderReportsDashboard').then(m => ({ default: m.ServiceProviderReportsDashboard })));
export const RouteRentabilityReport = lazyWithRetry(() => import('@/components/RouteRentabilityReport').then(m => ({ default: m.RouteRentabilityReport })));

// ============= Chat Components =============
export const UnifiedChatHub = lazyWithRetry(() => import('@/components/UnifiedChatHub').then(m => ({ default: m.UnifiedChatHub })));
export const FreightChat = lazyWithRetry(() => import('@/components/FreightChat').then(m => ({ default: m.FreightChat })));
export const ServiceChat = lazyWithRetry(() => import('@/components/ServiceChat').then(m => ({ default: m.ServiceChat })));

// ============= Modals - Heavy Components =============
export const FreightCheckinModal = lazyWithRetry(() => import('@/components/FreightCheckinModal'));
export const FreightWithdrawalModal = lazyWithRetry(() => import('@/components/FreightWithdrawalModal'));
export const TrackingConsentModal = lazyWithRetry(() => import('@/components/TrackingConsentModal').then(m => ({ default: m.TrackingConsentModal })));
export const FreightCheckinsViewer = lazyWithRetry(() => import('@/components/FreightCheckinsViewer'));
export const AutoRatingModal = lazyWithRetry(() => import('@/components/AutoRatingModal').then(m => ({ default: m.AutoRatingModal })));
export const SubscriptionPlans = lazyWithRetry(() => import('@/components/SubscriptionPlans'));
export const SubscriptionManager = lazyWithRetry(() => import('@/components/SubscriptionManager'));

// ============= Admin Components (Heavy) =============
export const AdminReportsPanel = lazyWithRetry(() => import('@/components/AdminReportsPanel').then(m => ({ default: m.AdminReportsPanel })));
export const SecurityMonitoringPanel = lazyWithRetry(() => import('@/components/SecurityMonitoringPanel').then(m => ({ default: m.SecurityMonitoringPanel })));
export const ErrorLogsPanel = lazyWithRetry(() => import('@/components/ErrorLogsPanel').then(m => ({ default: m.ErrorLogsPanel })));
export const IncidentManagementPanel = lazyWithRetry(() => import('@/components/IncidentManagementPanel').then(m => ({ default: m.IncidentManagementPanel })));

// ============= Company Management Components =============
export const CompanyDriverManager = lazyWithRetry(() => import('@/components/CompanyDriverManager').then(m => ({ default: m.CompanyDriverManager })));
export const CompanyVehicleAssignments = lazyWithRetry(() => import('@/components/CompanyVehicleAssignments').then(m => ({ default: m.CompanyVehicleAssignments })));
export const CompanyFinancialDashboard = lazyWithRetry(() => import('@/components/CompanyFinancialDashboard').then(m => ({ default: m.CompanyFinancialDashboard })));
export const FleetGPSTrackingMap = lazyWithRetry(() => import('@/components/FleetGPSTrackingMap').then(m => ({ default: m.FleetGPSTrackingMap })));
