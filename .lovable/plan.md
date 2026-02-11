

# Fix: BOOTSTRAP_TIMEOUT at INITIALIZING

## Problem

The app is timing out during boot, stuck at the `INITIALIZING` phase for 8+ seconds. The error report shows `BOOTSTRAP_TIMEOUT step=INITIALIZING`, meaning the BootOrchestrator never transitions the app past the initial phase before the global 8s timeout fires.

## Root Causes

1. **Stale closure in timeout handler**: The `forceTimeout` function in `AppBootContext` captures `state.phase` and `state.lastStep` at creation time. When the 8s timeout fires, it reads the stale initial values (`INITIALIZING`) even if the phase already changed. This causes incorrect timeout reports.

2. **Race condition**: The `BootOrchestrator` relies on `useAuth`'s `loading` state to transition phases. If Supabase's `getSession()` is slow (cold start, network latency), `authLoading` stays `true` and the orchestrator cannot progress.

3. **Timeout too aggressive for slow networks**: 8 seconds may not be enough on mobile/slow connections, especially when Supabase has a cold start.

## Solution

### 1. Fix stale closure in `forceTimeout` (AppBootContext.tsx)
- Use refs instead of state values inside `forceTimeout` to always read current phase/lastStep
- Add a `phaseRef` that tracks the current phase for the timeout handler

### 2. Improve BootOrchestrator resilience (BootOrchestrator.tsx)
- Remove the guard `if (hasStartedRef.current && phase !== 'INITIALIZING') return` which can block re-entry in edge cases
- Make the INITIALIZING to CHECKING_AUTH transition happen immediately on first render (not waiting for next effect cycle)

### 3. Increase timeout with platform awareness (AppBootContext.tsx)
- Increase timeout to 12s on native platforms (iOS/Android) where cold starts are more common
- Keep 8s for web

### Technical Details

**File: `src/contexts/AppBootContext.tsx`**
- Add `phaseRef` and `lastStepRef` to track current values for timeout handler
- Update `setPhase` to also update `phaseRef`
- Update `forceTimeout` to read from refs instead of state
- Adjust timeout: 12s for native, 10s for web

**File: `src/components/BootOrchestrator.tsx`**
- Simplify the main orchestration effect to be more deterministic
- Ensure INITIALIZING to CHECKING_AUTH happens on the very first effect run without conditions that could block it

