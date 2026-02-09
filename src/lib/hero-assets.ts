// Centralized hero background assets.
//
// IMPORTANTE: Estas constantes são usadas APENAS como fallback estático.
// A imagem de fundo dinâmica vem do hook useHeroBackground() que busca do banco de dados.
// Isso permite trocar a imagem sem precisar fazer deploy ou o usuário atualizar o app.

/** @deprecated Versioning removido para garantir cache hit com preload do index.html */
export const HERO_BG_VERSION = '';

/** @deprecated Use useHeroBackground() hook para imagem dinâmica do banco */
export const HERO_BG_DESKTOP = '/hero-truck-night-moon.webp';
/** @deprecated Use useHeroBackground() hook para imagem dinâmica do banco */
export const HERO_BG_MOBILE = '/hero-truck-night-moon-mobile.webp';
