// Lazy loaded components for better performance
import { lazy, Suspense, ComponentType } from 'react';

// ============= Utility Component for Loading States =============
export const ComponentLoader = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };
  
  return (
    <div className="flex items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-b-2 border-primary ${sizeClasses[size]}`}></div>
    </div>
  );
};

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
  const LazyComponent = lazy(importFn);
  
  return function WrappedComponent(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// ============= Dashboard Components =============
export const DriverDashboard = lazy(() => import('@/pages/DriverDashboard'));
export const ProducerDashboard = lazy(() => import('@/pages/ProducerDashboard'));
export const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
export const ServiceProviderDashboard = lazy(() => import('@/pages/ServiceProviderDashboard'));
export const CompanyDashboard = lazy(() => import('@/pages/CompanyDashboard'));
export const NfeDashboard = lazy(() => import('@/pages/NfeDashboard'));

// ============= Modal Components =============
export const AuthModal = lazy(() => import('@/components/AuthModal'));
export const FreightDetails = lazy(() => import('@/components/FreightDetails').then(module => ({ default: module.FreightDetails })));
export const UserProfileModal = lazy(() => import('@/components/UserProfileModal').then(module => ({ default: module.UserProfileModal })));
export const NotificationCenter = lazy(() => import('@/components/NotificationCenter').then(module => ({ default: module.NotificationCenter })));

// ============= Heavy Components (Charts, Maps, etc) =============
export const GoogleMap = lazy(() => import('@/components/MapLibreMap'));
export const SmartFreightMatcher = lazy(() => import('@/components/SmartFreightMatcher').then(m => ({ default: m.SmartFreightMatcher })));
export const AdvancedFreightSearch = lazy(() => import('@/components/AdvancedFreightSearch').then(m => ({ default: m.AdvancedFreightSearch })));
export const VehicleManager = lazy(() => import('@/components/VehicleManager').then(m => ({ default: m.VehicleManager })));
export const DriverAvailabilityCalendar = lazy(() => import('@/components/DriverAvailabilityCalendar').then(m => ({ default: m.DriverAvailabilityCalendar })));
export const ScheduledFreightsManager = lazy(() => import('@/components/ScheduledFreightsManager').then(m => ({ default: m.ScheduledFreightsManager })));
export const ServiceTypeManager = lazy(() => import('@/components/ServiceTypeManager').then(m => ({ default: m.ServiceTypeManager })));
export const MatchIntelligentDemo = lazy(() => import('@/components/MatchIntelligentDemo').then(m => ({ default: m.MatchIntelligentDemo })));
export const UserCityManager = lazy(() => import('@/components/UserCityManager').then(m => ({ default: m.UserCityManager })));
export const DriverAvailabilityAreasManager = lazy(() => import('@/components/DriverAvailabilityAreasManager').then(m => ({ default: m.DriverAvailabilityAreasManager })));
export const DriverRegionManager = lazy(() => import('@/components/DriverRegionManager').then(m => ({ default: m.DriverRegionManager })));
export const UnifiedLocationManager = lazy(() => import('@/components/UnifiedLocationManager'));
export const DriverPayouts = lazy(() => import('@/components/DriverPayouts').then(m => ({ default: m.DriverPayouts })));
export const UnifiedHistory = lazy(() => import('@/components/UnifiedHistory').then(m => ({ default: m.UnifiedHistory })));
export const PendingRatingsPanel = lazy(() => import('@/components/PendingRatingsPanel').then(m => ({ default: m.PendingRatingsPanel })));
export const DriverAutoLocationTracking = lazy(() => import('@/components/DriverAutoLocationTracking').then(m => ({ default: m.DriverAutoLocationTracking })));
export const PlatformStatsSection = lazy(() => import('@/components/PlatformStatsSection').then(m => ({ default: m.PlatformStatsSection })));

// ============= Fiscal Components (Heavy) =============
export const FiscalOnboardingWizard = lazy(() => import('@/components/fiscal/FiscalOnboardingWizard').then(m => ({ default: m.FiscalOnboardingWizard })));
export const CertificateUploadDialog = lazy(() => import('@/components/fiscal/CertificateUploadDialog').then(m => ({ default: m.CertificateUploadDialog })));
export const ComplianceDashboard = lazy(() => import('@/components/fiscal/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard })));

// ============= Report Components (Recharts - Heavy) =============
export const FreightAnalyticsDashboard = lazy(() => import('@/components/FreightAnalyticsDashboard').then(m => ({ default: m.FreightAnalyticsDashboard })));
export const CompanyAnalyticsDashboard = lazy(() => import('@/components/CompanyAnalyticsDashboard').then(m => ({ default: m.CompanyAnalyticsDashboard })));
export const PeriodComparisonDashboard = lazy(() => import('@/components/PeriodComparisonDashboard').then(m => ({ default: m.PeriodComparisonDashboard })));
export const ServiceProviderReportsDashboard = lazy(() => import('@/components/ServiceProviderReportsDashboard').then(m => ({ default: m.ServiceProviderReportsDashboard })));
export const RouteRentabilityReport = lazy(() => import('@/components/RouteRentabilityReport').then(m => ({ default: m.RouteRentabilityReport })));

// ============= Chat Components =============
export const UnifiedChatHub = lazy(() => import('@/components/UnifiedChatHub').then(m => ({ default: m.UnifiedChatHub })));
export const FreightChat = lazy(() => import('@/components/FreightChat').then(m => ({ default: m.FreightChat })));
export const ServiceChat = lazy(() => import('@/components/ServiceChat').then(m => ({ default: m.ServiceChat })));

// ============= Modals - Heavy Components =============
export const FreightCheckinModal = lazy(() => import('@/components/FreightCheckinModal'));
export const FreightWithdrawalModal = lazy(() => import('@/components/FreightWithdrawalModal'));
export const TrackingConsentModal = lazy(() => import('@/components/TrackingConsentModal').then(m => ({ default: m.TrackingConsentModal })));
export const FreightCheckinsViewer = lazy(() => import('@/components/FreightCheckinsViewer'));
export const AutoRatingModal = lazy(() => import('@/components/AutoRatingModal').then(m => ({ default: m.AutoRatingModal })));
export const SubscriptionPlans = lazy(() => import('@/components/SubscriptionPlans'));
export const SubscriptionManager = lazy(() => import('@/components/SubscriptionManager'));

// ============= Admin Components (Heavy) =============
export const AdminReportsPanel = lazy(() => import('@/components/AdminReportsPanel').then(m => ({ default: m.AdminReportsPanel })));
export const SecurityMonitoringPanel = lazy(() => import('@/components/SecurityMonitoringPanel').then(m => ({ default: m.SecurityMonitoringPanel })));
export const ErrorLogsPanel = lazy(() => import('@/components/ErrorLogsPanel').then(m => ({ default: m.ErrorLogsPanel })));
export const IncidentManagementPanel = lazy(() => import('@/components/IncidentManagementPanel').then(m => ({ default: m.IncidentManagementPanel })));

// ============= Company Management Components =============
export const CompanyDriverManager = lazy(() => import('@/components/CompanyDriverManager').then(m => ({ default: m.CompanyDriverManager })));
export const CompanyVehicleAssignments = lazy(() => import('@/components/CompanyVehicleAssignments').then(m => ({ default: m.CompanyVehicleAssignments })));
export const CompanyFinancialDashboard = lazy(() => import('@/components/CompanyFinancialDashboard').then(m => ({ default: m.CompanyFinancialDashboard })));
export const FleetGPSTrackingMap = lazy(() => import('@/components/FleetGPSTrackingMap').then(m => ({ default: m.FleetGPSTrackingMap })));