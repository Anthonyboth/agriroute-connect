// Centralized hero background assets.
//
// IMPORTANT:
// These images are served from /public and were previously configured with long-lived caching.
// Adding a version query string here guarantees clients see updates immediately even if
// the underlying filenames remain the same.

export const HERO_BG_VERSION = '20260123-1';

export const HERO_BG_DESKTOP = `/hero-truck-night-moon.webp?v=${HERO_BG_VERSION}`;
export const HERO_BG_MOBILE = `/hero-truck-night-moon-mobile.webp?v=${HERO_BG_VERSION}`;
