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

// Utility component for loading states
export const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);