import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import { purgeCSSPlugin } from '@fullhuman/postcss-purgecss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
// @ts-ignore - critical package doesn't have type definitions
import { generate } from 'critical';

// ✅ RELEASE HARDENING: Generate unique build ID
const BUILD_ID = `${new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;

// Plugin to make CSS async (non-render-blocking)
// ✅ ATIVADO v2 - usando media="print" pattern que é mais confiável
const asyncCssPlugin = () => ({
  name: 'async-css-plugin',
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      // Transform synchronous CSS links to async loading pattern using media="print"
      // This pattern is more reliable than preload as="style" across browsers
      return html.replace(
        /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+\.css)">/gi,
        (match, href) => {
          return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all';this.onload=null;">
    <noscript><link rel="stylesheet" href="${href}"></noscript>`;
        }
      );
    }
  }
});

// Plugin to inject cache version into Service Worker (DESABILITADO - usando generateSW)
// const swVersionPlugin = () => ({
//   name: 'sw-version-plugin',
//   writeBundle() {
//     const fs = require('fs');
//     const path = require('path');
//     const swPath = path.resolve(__dirname, 'dist/sw.js');
//     
//     if (fs.existsSync(swPath)) {
//       let content = fs.readFileSync(swPath, 'utf8');
//       const buildTime = new Date().toISOString().replace(/[:.]/g, '-');
//       content = content.replace(/__BUILD_TIME__/g, buildTime);
//       fs.writeFileSync(swPath, content);
//       console.log('✅ Service Worker versão atualizada:', buildTime);
//     }
//   }
// });

// Plugin to extract and inline critical CSS (DESABILITADO - estava causando falha no build)
// const criticalCssPlugin = () => ({
//   name: 'critical-css-plugin',
//   async closeBundle() {
//     if (process.env.NODE_ENV === 'production') {
//       try {
//         console.log('🎨 Extracting critical CSS...');
//         await generate({
//           inline: true,
//           base: 'dist',
//           src: 'index.html',
//           target: {
//             html: 'index.html',
//           },
//           width: 1920,
//           height: 1080,
//           extract: true,
//           minify: true,
//           penthouse: {
//             timeout: 60000,
//           },
//         });
//         console.log('✅ Critical CSS extracted and inlined successfully');
//       } catch (error) {
//         console.warn('⚠️  Critical CSS extraction failed:', error);
//         // Don't fail the build if critical CSS extraction fails
//       }
//     }
//   }
// });

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // ✅ RELEASE HARDENING: Base path for proper asset resolution
  // Empty string = relative paths, works in Netlify, Capacitor, and any subdirectory
  base: '/',
  
  server: {
    host: "::",
    port: 8080,
  },
  
  // ✅ RELEASE HARDENING: Inject build ID and mode as global constants
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __APP_MODE__: JSON.stringify(mode),
  },
  // ✅ PERFORMANCE: PostCSS com PurgeCSS para reduzir CSS não utilizado
  css: {
    devSourcemap: false, // Disable CSS sourcemaps in dev for faster HMR
    postcss: {
      plugins: [
        // ✅ CRÍTICO: Tailwind DEVE vir primeiro para compilar @tailwind/@apply
        tailwindcss(),
        autoprefixer(),
        // PurgeCSS apenas em produção, APÓS Tailwind compilar
        ...(mode === 'production' ? [
          purgeCSSPlugin({
            content: [
              './index.html',
              './src/**/*.{js,ts,jsx,tsx}',
            ],
             // ✅ HOTFIX (modais com "tela preta"):
             // O PurgeCSS estava removendo classes Tailwind com valores arbitrários (ex: z-[10000], left-[50%], translate-x-[-50%]).
             // Isso faz o overlay do Radix aparecer sem o conteúdo/posicionamento correto.
             // Incluímos [ ] % . para manter esses utilitários.
             defaultExtractor: (content: string) => content.match(/[\w-/:.\[\]%]+(?<!:)/g) || [],
            safelist: {
              standard: [
                /^html/,
                /^body/,
                /^:root/,
                /^dark/,
                // Radix UI
                /^data-/,
                /\[data-.*\]/,
                // Tailwind dynamic classes
                /^bg-/,
                /^text-/,
                /^border-/,
                /^hover:/,
                /^focus:/,
                /^active:/,
                /^disabled:/,
                /^group-/,
                /^peer-/,
                // Animations
                /^animate-/,
                /^transition-/,
                // Responsive
                /^sm:/,
                /^md:/,
                /^lg:/,
                /^xl:/,
                /^2xl:/,
                // ✅ AgriRoute Design System - Classes customizadas
                /^gradient-/,        // gradient-hero, gradient-primary, gradient-card
                /^shadow-/,          // shadow-elegant, shadow-card, shadow-glow
                /^btn-/,             // btn-accessible
                /^card-/,            // card-accessible
                /^text-gradient-/,   // text-gradient-hero
                /^text-shadow-/,     // text-shadow-lg, text-shadow-md
                /^text-accessible/,  // text-accessible, text-large-accessible
                /^freight-/,         // freight-card-standard
                /^spacing-/,         // spacing-accessible
                /^pentagon-/,        // pentagon-card
                /^status-/,          // status-open, status-booked, etc.
                /^scroll-/,          // scroll-area
                /^safe-/,            // safe-area-*, safe-text
                /^responsive-/,      // responsive-card-header, responsive-card-actions
                /^badge-/,           // badge-inline
                /^touch-/,           // touch-target-safe
                /^prevent-/,         // prevent-button-overlap
                /^provider-/,        // provider-theme
                'transition-smooth',
                'transition-bounce',
              ],
              deep: [
                /radix/,
                /sonner/,
                /cmdk/,
              ],
              greedy: [
                /^lucide-/,
                 // ✅ Manter utilitários Tailwind com valores arbitrários: z-[...], left-[...], max-h-[...], translate-x-[...], etc.
                 /\[[^\]]+\]/,
              ]
            }
          })
        ] : []),
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ OTIMIZADO v3 - split mais granular para reduzir unused JS
          // Corrigido para evitar "f is not a function" em chunks Radix UI
          
          // Core React (mínimo necessário para boot)
          if (id.includes('node_modules/react-dom')) {
            return 'react-dom';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'react-core';
          }
          
          // React Router - separado (usado após hidratação)
          if (id.includes('react-router')) {
            return 'react-router';
          }
          
          // Supabase - carrega apenas quando autenticado (defer)
          if (id.includes('@supabase/realtime') || id.includes('@supabase/functions')) {
            return 'supabase-realtime';
          }
          if (id.includes('@supabase')) {
            return 'supabase-core';
          }
          
          // ✅ TODOS os componentes Radix UI em um ÚNICO chunk
          // Isso evita o erro "f is not a function" causado por fragmentação de contexto React
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          
          // Lucide icons - split by size
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // TanStack Query - defer (usado após autenticação)
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
        }
      }
    },
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
      },
      mangle: {
        keep_fnames: true,
        keep_classnames: true
      }
    },
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    // ✅ ATIVADO - CSS async para eliminar render-blocking
    mode === 'production' && asyncCssPlugin(),
    // swVersionPlugin() - não necessário com generateSW strategy
    // criticalCssPlugin() - desabilitado por causar falha no build
    VitePWA({
      registerType: 'autoUpdate',
      // ✅ CRÍTICO: Não injetar registro automático - faremos manualmente para controlar Preview
      injectRegister: false,
      strategies: 'generateSW',
      includeAssets: ['favicon.ico', 'hero-truck-night-moon.webp', 'apple-touch-icon.png'],
      manifest: {
        name: 'AGRIROUTE',
        short_name: 'AGRIROUTE',
        description: 'Plataforma de gestão de fretes agrícolas',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // ✅ REMOVIDO html do globPatterns para evitar servir HTML antigo que aponta para chunks inexistentes
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,jpg,webp,avif}'],
        maximumFileSizeToCacheInBytes: 5000000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // ✅ Navegação (HTML) usa NetworkFirst com fallback rápido
        navigateFallback: null, // Desabilita fallback offline para HTML
        runtimeCaching: [
          // ✅ NOVO: HTML/Navegação sempre busca da rede primeiro
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 10 // 10 minutos
              },
              networkTimeoutSeconds: 3,
            }
          },
          {
            urlPattern: /^https:\/\/shnvtxejjecbnztdbbbl\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5,
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      'react', 
      'react-dom',
      // Deduplicate ALL Radix UI packages to prevent version mismatches
      '@radix-ui/primitive',
      '@radix-ui/react-primitive',
      '@radix-ui/react-compose-refs',
      '@radix-ui/react-context',
      '@radix-ui/react-id',
      '@radix-ui/react-presence',
      '@radix-ui/react-slot',
      '@radix-ui/react-use-callback-ref',
      '@radix-ui/react-use-controllable-state',
      '@radix-ui/react-use-layout-effect',
      // Additional internal packages for complete stability
      '@radix-ui/react-collection',
      '@radix-ui/react-direction',
      '@radix-ui/react-dismissable-layer',
      '@radix-ui/react-focus-scope',
      '@radix-ui/react-focus-guards',
      '@radix-ui/react-portal',
      '@radix-ui/react-roving-focus',
      '@radix-ui/react-visually-hidden',
      '@radix-ui/react-arrow',
      '@radix-ui/react-popper',
    ],
  },
  optimizeDeps: {
    include: [
      'recharts',
      'd3-shape',
      'd3-scale',
      'd3-interpolate',
      'd3-path',
      'd3-color',
      'd3-format',
      'd3-time',
      'd3-time-format',
      'd3-array'
    ],
    esbuildOptions: {
      target: 'es2020',
    }
  },
}));
