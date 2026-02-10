/**
 * Local storage helpers for tutorial state.
 * DB persistence is optional (future enhancement).
 */

const STORAGE_KEY = 'agriroute_tutorial';

export interface TutorialState {
  started_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  /** ISO string - 15 days after signup */
  can_replay_until: string | null;
}

function getKey(profileId: string) {
  return `${STORAGE_KEY}_${profileId}`;
}

export function getTutorialState(profileId: string): TutorialState {
  try {
    const raw = localStorage.getItem(getKey(profileId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { started_at: null, completed_at: null, skipped_at: null, can_replay_until: null };
}

export function setTutorialState(profileId: string, state: Partial<TutorialState>) {
  try {
    const current = getTutorialState(profileId);
    const updated = { ...current, ...state };
    localStorage.setItem(getKey(profileId), JSON.stringify(updated));
  } catch {}
}

export function canReplayTutorial(profileId: string, createdAt?: string): boolean {
  const state = getTutorialState(profileId);
  
  // If never completed/skipped, always allow
  if (!state.completed_at && !state.skipped_at) return true;
  
  // Check 15-day window
  if (state.can_replay_until) {
    return new Date() < new Date(state.can_replay_until);
  }
  
  // Fallback: use profile created_at
  if (createdAt) {
    const cutoff = new Date(createdAt);
    cutoff.setDate(cutoff.getDate() + 15);
    return new Date() < cutoff;
  }
  
  return false;
}

export function shouldAutoStartTutorial(profileId: string): boolean {
  const state = getTutorialState(profileId);
  return !state.completed_at && !state.skipped_at && !state.started_at;
}

export function initTutorialReplayWindow(profileId: string, createdAt: string) {
  const state = getTutorialState(profileId);
  if (!state.can_replay_until) {
    const cutoff = new Date(createdAt);
    cutoff.setDate(cutoff.getDate() + 15);
    setTutorialState(profileId, { can_replay_until: cutoff.toISOString() });
  }
}
