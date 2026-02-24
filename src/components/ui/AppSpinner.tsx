import { cn } from '@/lib/utils';

interface AppSpinnerProps {
  /** Size of the spinner: 'sm' (16px), 'md' (32px), 'lg' (48px), or custom number */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Additional CSS classes */
  className?: string;
  /** If true, centers the spinner in a full-screen container */
  fullscreen?: boolean;
}

const sizeMap = {
  sm: 'h-5 w-5',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

/**
 * AppSpinner - Unified loading spinner for the entire application
 * 
 * Uses the border-spin style (Style A) without any text.
 * This is the SINGLE SOURCE OF TRUTH for all loading states.
 * 
 * @example
 * // Basic usage
 * <AppSpinner />
 * 
 * // Different sizes
 * <AppSpinner size="sm" />
 * <AppSpinner size="lg" />
 * <AppSpinner size={24} /> // custom pixel size
 * 
 * // Fullscreen centered
 * <AppSpinner fullscreen />
 */
export const AppSpinner = ({ 
  size: sizeProp, 
  className,
  fullscreen = false 
}: AppSpinnerProps) => {
  // Fullscreen ALWAYS uses 'lg' for consistency across the app
  const size = sizeProp ?? (fullscreen ? 'lg' : 'md');
  const sizeClass = typeof size === 'number' 
    ? undefined 
    : sizeMap[size];
  
  const sizeStyle = typeof size === 'number' 
    ? { width: size, height: size } 
    : undefined;

  const spinner = (
    <div
      className={cn(
        'rounded-full border-[3px] border-primary/20 border-t-primary animate-spin',
        sizeClass,
        className
      )}
      style={sizeStyle}
      role="status"
      aria-label="Carregando"
    />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * CenteredSpinner - Spinner centered in its container
 * Useful for card/section loading states
 */
export const CenteredSpinner = ({ 
  size = 'md',
  className 
}: Omit<AppSpinnerProps, 'fullscreen'>) => (
  <div className={cn('flex items-center justify-center py-8', className)}>
    <AppSpinner size={size} />
  </div>
);

/**
 * InlineSpinner - Small spinner for inline/button usage
 */
export const InlineSpinner = ({ className }: { className?: string }) => (
  <AppSpinner size="sm" className={cn('mr-2', className)} />
);

export default AppSpinner;
