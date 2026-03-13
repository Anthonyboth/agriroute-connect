

## Problem

The hero background image shown in the producer dashboard (and other dashboards) does not match the image you uploaded. The system uses the `useHeroBackground()` hook which loads the image from the `hero_backgrounds` database table, with local files as fallback.

## Root Cause

The current hero image files in `public/` (`hero-truck-night-moon.webp` and `hero-truck-night-moon-mobile.webp`) are outdated. The uploaded image needs to replace them both as local fallbacks and in the database record.

## Plan

### 1. Replace local hero image files
- Copy the uploaded image (`user-uploads://image-900.png`) to `public/hero-truck-night-moon.webp` (desktop) and `public/hero-truck-night-moon-mobile.webp` (mobile), overwriting the existing files.

### 2. Update the database record
- Create a migration to update the `hero_backgrounds` table, setting the active record's `image_url` and `mobile_image_url` to point to the new files (same paths, but the content will be the new image).

### 3. Update the inline fallback in `index.html`
- The `index.html` has an inline `<picture>` element for LCP optimization that references the same files. Since the filenames stay the same, no code change is needed -- the new image content will be served automatically.

### Technical Note
All 6 hero consumers (`ProducerDashboardHero`, `DriverDashboardHero`, `ServiceProviderHeroDashboard`, `CompanyDashboard`, `Landing`, `ProducerDashboard`) use the same `useHeroBackground()` hook, so updating the image files and DB record will propagate to all panels simultaneously.

