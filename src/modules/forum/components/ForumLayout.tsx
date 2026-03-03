import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ForumIcon } from './ForumIcon';
import { BackButton } from '@/components/BackButton';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface ForumLayoutProps {
  title: string;
  breadcrumbs: Breadcrumb[];
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function ForumLayout({ title, breadcrumbs, children, sidebar }: ForumLayoutProps) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Back button */}
        <div className="mb-4">
          <BackButton to="/" label="Voltar ao App" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <ForumIcon size={28} className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3" />}
                  {bc.href ? (
                    <Link to={bc.href} className="hover:text-foreground transition-colors">{bc.label}</Link>
                  ) : (
                    <span className="text-foreground/70">{bc.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>

        {/* Content with optional sidebar */}
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">{children}</div>
          {sidebar && (
            <aside className="hidden lg:block w-72 flex-shrink-0">
              {sidebar}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
