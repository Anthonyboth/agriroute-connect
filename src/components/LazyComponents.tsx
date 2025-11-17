// Lazy loaded components for better performance
import { lazy } from 'react';

// Dashboard Components
export const DriverDashboard = lazy(() => import('@/pages/DriverDashboard'));
export const ProducerDashboard = lazy(() => import('@/pages/ProducerDashboard'));
export const AdminPanel = lazy(() => import('@/pages/AdminPanel'));
export const ServiceProviderDashboard = lazy(() => import('@/pages/ServiceProviderDashboard'));

// Modal Components that have default exports
export const AuthModal = lazy(() => import('@/components/AuthModal'));
export const CreateFreightModal = lazy(() => import('@/components/CreateFreightModal'));

// Other Components with named exports
export const FreightDetails = lazy(() => import('@/components/FreightDetails').then(module => ({ default: module.FreightDetails })));
export const UserProfileModal = lazy(() => import('@/components/UserProfileModal').then(module => ({ default: module.UserProfileModal })));
export const NotificationCenter = lazy(() => import('@/components/NotificationCenter').then(module => ({ default: module.NotificationCenter })));

// Form Components
export const DocumentUpload = lazy(() => import('@/components/DocumentUpload'));
export const ProfilePhotoUpload = lazy(() => import('@/components/ProfilePhotoUpload'));

// Complex Components
export const GoogleMap = lazy(() => import('@/components/GoogleMap'));
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

// Modals - Heavy Components
export const FreightCheckinModal = lazy(() => import('@/components/FreightCheckinModal'));
export const FreightWithdrawalModal = lazy(() => import('@/components/FreightWithdrawalModal'));
export const TrackingConsentModal = lazy(() => import('@/components/TrackingConsentModal').then(m => ({ default: m.TrackingConsentModal })));
export const FreightCheckinsViewer = lazy(() => import('@/components/FreightCheckinsViewer'));
export const AutoRatingModal = lazy(() => import('@/components/AutoRatingModal').then(m => ({ default: m.AutoRatingModal })));

// Chat Components
export const UnifiedChatHub = lazy(() => import('@/components/UnifiedChatHub').then(m => ({ default: m.UnifiedChatHub })));

// Utility component for loading states
export const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);