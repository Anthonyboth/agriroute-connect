import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminForumCategories = lazy(() => import('./pages/AdminForumCategories'));
const AdminForumBoards = lazy(() => import('./pages/AdminForumBoards'));
const AdminForumThreads = lazy(() => import('./pages/AdminForumThreads'));
const AdminForumPosts = lazy(() => import('./pages/AdminForumPosts'));
const AdminForumReports = lazy(() => import('./pages/AdminForumReports'));
const AdminForumBans = lazy(() => import('./pages/AdminForumBans'));
const AdminForumLogs = lazy(() => import('./pages/AdminForumLogs'));

const tabs = [
  { value: 'categorias', label: 'Categorias', path: '' },
  { value: 'subforuns', label: 'Subfóruns', path: 'subforuns' },
  { value: 'topicos', label: 'Tópicos', path: 'topicos' },
  { value: 'posts', label: 'Posts', path: 'posts' },
  { value: 'denuncias', label: 'Denúncias', path: 'denuncias' },
  { value: 'bans', label: 'Banimentos', path: 'bans' },
  { value: 'logs', label: 'Logs', path: 'logs' },
];

export function AdminForumRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname.replace('/admin-v2/forum', '').replace(/^\//, '');
    const found = tabs.find(t => t.path === path);
    return found?.value || 'categorias';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card px-6 pt-4">
        <h1 className="text-2xl font-bold mb-3">Gestão do Fórum</h1>
        <Tabs value={getActiveTab()} onValueChange={v => {
          const tab = tabs.find(t => t.value === v);
          navigate(`/admin-v2/forum${tab?.path ? '/' + tab.path : ''}`);
        }}>
          <TabsList className="flex-wrap">
            {tabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-sm">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<div className="flex items-center justify-center p-8"><AppSpinner /></div>}>
          <Routes>
            <Route index element={<AdminForumCategories />} />
            <Route path="subforuns" element={<AdminForumBoards />} />
            <Route path="topicos" element={<AdminForumThreads />} />
            <Route path="posts" element={<AdminForumPosts />} />
            <Route path="denuncias" element={<AdminForumReports />} />
            <Route path="bans" element={<AdminForumBans />} />
            <Route path="logs" element={<AdminForumLogs />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
