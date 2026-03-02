
## Problem

The close button on the "Motorista Afiliado" banner (CompanyDriverBadge) exists in code with an X icon, but visually the X is not appearing in the deployed version. The button shows as a small empty circle.

## Root Cause

The button at line 50-57 of `CompanyDriverBadge.tsx` already has `<X className="h-4 w-4" strokeWidth={3} />` with `text-white` and `bg-destructive`. The icon may not be rendering due to CSS specificity issues or the SVG stroke color being overridden.

## Fix

Make the X icon more explicitly visible by:

1. **Add explicit color to the X icon itself** -- use `text-white` directly on the `<X>` component and add `!important` via inline style or explicit `stroke` prop
2. **Increase button size slightly** from `h-7 w-7` to `h-8 w-8` for better visibility
3. **Add a shadow** to make it stand out more against the light background

Single file change: `src/components/CompanyDriverBadge.tsx`, lines 50-57.
