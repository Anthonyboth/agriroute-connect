import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FEATURE_FORUM } from './config';
import { ComponentLoader } from '@/components/LazyComponents';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const ForumHome = lazyWithRetry(() => import('./pages/ForumHome'));
const ForumBoardPage = lazyWithRetry(() => import('./pages/ForumBoardPage'));
const ForumThreadPage = lazyWithRetry(() => import('./pages/ForumThreadPage'));
const ForumNewThread = lazyWithRetry(() => import('./pages/ForumNewThread'));

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
