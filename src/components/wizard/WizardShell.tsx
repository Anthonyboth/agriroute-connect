import React from 'react';
import { cn } from '@/lib/utils';

interface WizardShellProps {
  /** Header content (title, description) - fixed at top */
  header?: React.ReactNode;
  /** Progress indicator content - fixed below header */
  progress?: React.ReactNode;
  /** Alert content (e.g., draft restore) - fixed below progress */
  alert?: React.ReactNode;
  /** Main step content - scrollable */
  children: React.ReactNode;
  /** Footer content (navigation buttons) - fixed at bottom */
  footer?: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * WizardShell - A reusable layout component for multi-step wizards
 * 
 * Provides a consistent structure with:
 * - Fixed header at top
 * - Fixed progress indicator
 * - Optional fixed alert area
 * - Scrollable content area
 * - Fixed footer with navigation buttons
 * 
 * This ensures:
 * - Content always scrolls when it overflows
 * - Navigation buttons are always visible and accessible
 * - Works correctly in modals with fixed height
 */
export const WizardShell: React.FC<WizardShellProps> = ({
  header,
  progress,
  alert,
  children,
  footer,
  className
}) => {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Header - Fixed at top */}
      {header && (
        <div className="shrink-0 border-b">
          {header}
        </div>
      )}

      {/* Progress - Fixed below header */}
      {progress && (
        <div className="shrink-0 border-b">
          {progress}
        </div>
      )}

      {/* Alert - Fixed below progress */}
      {alert && (
        <div className="shrink-0">
          {alert}
        </div>
      )}

      {/* Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>

      {/* Footer - Fixed at bottom with safe area padding for mobile */}
      {footer && (
        <div className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
          {footer}
        </div>
      )}
    </div>
  );
};

export default WizardShell;
