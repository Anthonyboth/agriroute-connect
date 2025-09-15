import React from 'react';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { useAuth } from '@/hooks/useAuth';

const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  
  return (
    <ResponsiveLayout>
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Painel de Prestador de Serviços</h1>
        <button 
          onClick={signOut} 
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Sair
        </button>
      </header>
      <ServiceDashboard />
    </ResponsiveLayout>
  );
};

export default ServiceProviderDashboard;