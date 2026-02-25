import { useState, useCallback, useEffect } from 'react';

export interface CarrierSavedView {
  id: string;
  name: string;
  createdAt: string;
  dateRange: { from: string; to: string };
  slicers: {
    status: string[];
    driverQuery: string;
    routeQuery: string;
    minKm?: number;
    maxKm?: number;
    minRevenue?: number;
    maxRevenue?: number;
  };
  sort?: { key: 'revenue' | 'rs_km' | 'trips' | 'cancel_rate'; dir: 'asc' | 'desc' };
}

const LS_KEY = 'agriroute:carrier:savedViews:v1';

function loadViews(): CarrierSavedView[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistViews(views: CarrierSavedView[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(views)); } catch {}
}

export const DEFAULT_VIEW_SUGGESTIONS: Omit<CarrierSavedView, 'id' | 'createdAt'>[] = [
  {
    name: 'Operacional',
    dateRange: { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
    slicers: { status: ['IN_TRANSIT', 'ACCEPTED', 'OPEN'], driverQuery: '', routeQuery: '' },
    sort: { key: 'trips', dir: 'desc' },
  },
  {
    name: 'Financeiro',
    dateRange: { from: new Date(Date.now() - 90 * 86400000).toISOString(), to: new Date().toISOString() },
    slicers: { status: ['DELIVERED', 'COMPLETED'], driverQuery: '', routeQuery: '' },
    sort: { key: 'revenue', dir: 'desc' },
  },
  {
    name: 'Risco',
    dateRange: { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() },
    slicers: { status: ['CANCELLED'], driverQuery: '', routeQuery: '' },
    sort: { key: 'cancel_rate', dir: 'desc' },
  },
];

export function useCarrierSavedViews() {
  const [views, setViews] = useState<CarrierSavedView[]>(loadViews);

  useEffect(() => { persistViews(views); }, [views]);

  const saveView = useCallback((view: Omit<CarrierSavedView, 'id' | 'createdAt'>) => {
    const newView: CarrierSavedView = {
      ...view,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setViews(prev => [...prev, newView]);
    return newView;
  }, []);

  const deleteView = useCallback((id: string) => {
    setViews(prev => prev.filter(v => v.id !== id));
  }, []);

  const renameView = useCallback((id: string, name: string) => {
    setViews(prev => prev.map(v => v.id === id ? { ...v, name } : v));
  }, []);

  return { views, saveView, deleteView, renameView };
}
