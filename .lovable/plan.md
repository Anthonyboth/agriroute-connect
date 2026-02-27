

## Problem Analysis

The profile modal (`UserProfileModal.tsx`) fails to scroll on iOS WebView, causing Apple App Store rejection. Two root causes:

1. **CSS conflict**: The base `DialogContent` class includes `overflow-y-auto` (line 68 of dialog.tsx), but the modal overrides with `overflow-hidden`. Tailwind class merge order can be unreliable, meaning the base `overflow-y-auto` may win on some renderers.

2. **Radix ScrollArea + iOS WebView incompatibility**: Radix `ScrollArea` uses custom JS-based scrolling that breaks in iOS WebViews (Capacitor/Safari). Native overflow scrolling with `-webkit-overflow-scrolling: touch` is required for iOS compliance.

## Plan

### Step 1: Fix UserProfileModal scroll for iOS

Replace the Radix `ScrollArea` with a native scrollable `div` that uses `-webkit-overflow-scrolling: touch` for iOS compatibility:

```tsx
// Replace:
<ScrollArea className="flex-1 min-h-0">
  <div className="px-4 sm:px-6 pb-6" style={...}>

// With:
<div 
  className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
  style={{ WebkitOverflowScrolling: 'touch' }}
>
  <div className="px-4 sm:px-6 pb-6" style={...}>
```

### Step 2: Ensure DialogContent overflow-hidden wins

In `UserProfileModal.tsx`, add `!overflow-hidden` (Tailwind important modifier) to the DialogContent className to guarantee it overrides the base `overflow-y-auto`:

```tsx
<DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col !overflow-hidden">
```

### Step 3: Add safe-area padding for iOS notch/home indicator

Ensure the scrollable container respects iOS safe areas at bottom with `env(safe-area-inset-bottom)` — already present in the inner div's style, which is correct.

---

**Technical note**: Radix ScrollArea renders a custom scrollbar overlay that intercepts touch events. iOS WebView does not propagate these correctly, resulting in a frozen/non-scrollable view. Native `overflow-y-auto` with `-webkit-overflow-scrolling: touch` is the only reliable solution for Capacitor iOS builds.

