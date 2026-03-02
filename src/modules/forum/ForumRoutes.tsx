import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FEATURE_FORUM } from './config';
import { ComponentLoader } from '@/components/LazyComponents';

const ForumHome = lazy(() => import('./pages/ForumHome'));
const ForumBoardPage = lazy(() => import('./pages/ForumBoardPage'));
const ForumThreadPage = lazy(() => import('./pages/ForumThreadPage'));
const ForumNewThread = lazy(() => import('./pages/ForumNewThread'));

export function ForumRoutes() {
  if (!FEATURE_FORUM) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<ComponentLoader />}>
      <Routes>
        <Route index element={<ForumHome />} />
        <Route path="subforum/:slug" element={<ForumBoardPage />} />
        <Route path="r/:slug" element={<ForumBoardPage />} />
        <Route path="topico/:id" element={<ForumThreadPage />} />
        <Route path="novo-topico" element={<ForumNewThread />} />
      </Routes>
    </Suspense>
  );
}
