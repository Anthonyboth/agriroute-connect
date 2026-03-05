import { usePullToRefresh } from '@/hooks/usePullToRefresh';

/**
 * Global pull-to-refresh component.
 * Place inside the app tree to enable swipe-down-to-reload on mobile.
 */
export function PullToRefresh() {
  usePullToRefresh();
  return null;
}
