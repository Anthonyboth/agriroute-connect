import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';
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
}

export function ForumLayout({ title, breadcrumbs, children }: ForumLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Botão Voltar ao App */}
        <div className="mb-4">
          <BackButton to="/" label="Voltar ao App" />
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
          <ForumIcon size={16} className="h-4 w-4" />
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="h-3 w-3" />}
              {bc.href ? (
                <Link to={bc.href} className="hover:text-foreground transition-colors">{bc.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{bc.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
