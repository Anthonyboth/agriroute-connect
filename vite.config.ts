import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import purgecss from '@fullhuman/postcss-purgecss';
// @ts-ignore - critical package doesn't have type definitions
import { generate } from 'critical';

// Plugin to make CSS async (non-render-blocking)
const asyncCssPlugin = () => ({
  name: 'async-css-plugin',
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      // Transform synchronous CSS links to async loading pattern
      return html.replace(
        /<link ([^>]*?)rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*?)>/gi,
        (match, before, middle, href, after) => {
          // Create async CSS loading with preload + onload pattern
          return `<link ${before}rel="preload"${middle}href="${href}"${after} as="style" onload="this.onload=null;this.rel='stylesheet'">
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
  server: {
    host: "::",
    port: 8080,
  },
  // ✅ PERFORMANCE: PostCSS com PurgeCSS - SAFELIST ROBUSTA v2
  // Preserva todas as classes dinâmicas, variáveis CSS, e componentes de terceiros
  css: {
    postcss: {
      plugins: mode === 'production' ? [
        purgecss({
          content: [
            './index.html',
            './src/**/*.{js,jsx,ts,tsx}',
          ],
          // SAFELIST ULTRA-EXTENSIVA - preserva todas as classes críticas
          safelist: {
            standard: [
              // === TAILWIND UTILITIES (todas as variantes dinâmicas) ===
              /^bg-/, /^text-/, /^border-/, /^ring-/, /^shadow-/, /^outline-/,
              /^hover:/, /^focus:/, /^active:/, /^disabled:/, /^visited:/,
              /^dark:/, /^light:/, /^group-/, /^peer-/, /^has-/,
              /^data-/, /^aria-/, /^state-/,
              /^sm:/, /^md:/, /^lg:/, /^xl:/, /^2xl:/,
              /^min-/, /^max-/, /^w-/, /^h-/, /^p-/, /^m-/, /^gap-/,
              /^space-/, /^flex-/, /^grid-/, /^col-/, /^row-/,
              /^items-/, /^justify-/, /^self-/, /^place-/,
              /^rounded-/, /^opacity-/, /^scale-/, /^rotate-/, /^translate-/,
              /^inset-/, /^top-/, /^right-/, /^bottom-/, /^left-/,
              /^z-/, /^overflow-/, /^cursor-/, /^pointer-/,
              /^font-/, /^leading-/, /^tracking-/, /^whitespace-/,
              /^list-/, /^decoration-/, /^underline/, /^line-through/,
              /^truncate/, /^break-/, /^hyphens-/,
              /^transition-/, /^duration-/, /^ease-/, /^delay-/,
              /^animate-/, /^animation-/,
              /^fill-/, /^stroke-/,
              /^origin-/, /^transform/,
              /^aspect-/, /^object-/,
              /^select-/, /^resize-/, /^appearance-/,
              /^scroll-/, /^snap-/, /^touch-/,
              /^will-change-/, /^isolation-/, /^mix-blend-/,
              /^backdrop-/, /^filter-/, /^blur-/, /^brightness-/, /^contrast-/, /^grayscale-/, /^hue-rotate-/, /^invert-/, /^saturate-/, /^sepia-/,
              /^drop-shadow-/,
              /^ring-offset-/,
              /^divide-/,
              /^sr-only/, /^not-sr-only/,
              /^outline-offset-/,
              /^accent-/, /^caret-/,
              /^columns-/, /^break-/,
              /^table-/, /^caption-/,
              
              // === DESIGN SYSTEM CUSTOM CLASSES ===
              'gradient-primary', 'gradient-hero', 'gradient-card',
              'shadow-elegant', 'shadow-card', 'shadow-glow',
              'transition-smooth', 'transition-bounce',
              'btn-accessible', 'card-accessible', 'text-accessible', 'text-large-accessible', 'spacing-accessible',
              'freight-card-standard',
              'provider-theme',
              'scroll-area',
              'touch-target-safe', 'prevent-button-overlap',
              
              // === STATUS BADGES ===
              /^status-/, 'status-open', 'status-booked', 'status-in-transit', 'status-delivered', 'status-cancelled',
              
              // === SAFE AREA UTILITIES ===
              /^safe-area-/, 'safe-area-top-right', 'safe-area-top-left', 'safe-area-bottom-right', 'safe-area-bottom-left',
              
              // === PENTAGON ANIMATIONS ===
              /^pentagon-/,
              
              // === FORM STATES ===
              /^valid:/, /^invalid:/, /^required:/, /^optional:/, /^read-only:/, /^placeholder:/,
              /^checked:/, /^indeterminate:/, /^default:/,
              /^enabled:/, /^focus-visible:/, /^focus-within:/,
              /^open:/, /^closed:/,
              /^empty:/, /^first:/, /^last:/, /^odd:/, /^even:/,
              /^only:/, /^first-of-type:/, /^last-of-type:/,
              
              // === MOTION SAFE/REDUCE ===
              /^motion-safe:/, /^motion-reduce:/,
              
              // === PRINT ===
              /^print:/,
              
              // === CONTRAST ===
              /^contrast-more:/, /^contrast-less:/,
              
              // === FORCED COLORS ===
              /^forced-colors:/,
              
              // === LANDSCAPE/PORTRAIT ===
              /^landscape:/, /^portrait:/,
            ],
            deep: [
              // === THIRD-PARTY LIBRARIES ===
              /radix/, // Radix UI (Dialog, Popover, Select, etc)
              /sonner/, // Toast notifications
              /lucide/, // Icons
              /recharts/, // Charts
              /cmdk/, // Command palette
              /vaul/, // Drawer
              /embla/, // Carousel
              /react-day-picker/, // Calendar
              /react-resizable-panels/, // Resizable panels
            ],
            greedy: [
              // === SCROLLBAR STYLES ===
              /scroll/, /scrollbar/,
              
              // === ACCESSIBILITY ===
              /btn-/, /card-/, /text-/, /spacing-/,
              
              // === CHART ELEMENTS ===
              /recharts-/, /chart-/,
              
              // === TOASTER ===
              /toast/, /sonner/,
              
              // === DIALOG/MODAL ===
              /dialog/, /modal/, /overlay/, /backdrop/,
              
              // === DROPDOWN/MENU ===
              /dropdown/, /menu/, /popover/, /tooltip/,
              
              // === TABS ===
              /tab/, /tabs/,
              
              // === ACCORDION ===
              /accordion/, /collapsible/,
              
              // === FORM ELEMENTS ===
              /input/, /select/, /checkbox/, /radio/, /switch/, /slider/, /toggle/,
              
              // === ALERTS ===
              /alert/, /warning/, /error/, /success/, /info/,
              
              // === BADGES ===
              /badge/,
              
              // === BUTTONS ===
              /button/, /btn/,
              
              // === CARDS ===
              /card/,
              
              // === AVATARS ===
              /avatar/,
              
              // === PROGRESS ===
              /progress/,
              
              // === SKELETON ===
              /skeleton/, /shimmer/,
              
              // === SHEET ===
              /sheet/, /drawer/,
              
              // === SEPARATOR ===
              /separator/, /divider/,
              
              // === NAVIGATION ===
              /nav/, /navigation/, /breadcrumb/,
              
              // === SIDEBAR ===
              /sidebar/,
              
              // === TABLE ===
              /table/, /thead/, /tbody/, /tfoot/, /tr/, /th/, /td/,
              
              // === ASPECT RATIO ===
              /aspect/,
              
              // === CONTAINER ===
              /container/,
            ]
          },
          // CRITICAL: Preserve CSS variables, keyframes, font-faces
          keyframes: true,
          variables: true,
          fontFace: true,
          // Don't remove :root or :host selectors
          blocklist: []
        })
      ] : []
    },
    devSourcemap: false, // Disable CSS sourcemaps in dev for faster HMR
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ PERFORMANCE: Otimizado para HTTP/2 + tree-shaking agressivo
          
          // Core React + Router (crítico, sempre necessário)
          if (id.includes('node_modules/react') || id.includes('react-router') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          
          // Supabase - carrega apenas quando autenticado
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          
          // Charts - carrega apenas em dashboards (recharts + d3 juntos)
          if (id.includes('recharts') || id.includes('d3-') || id.includes('d3.')) {
            return 'charts-vendor';
          }
          
          // UI components - separado para melhor cache
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          
          // Forms & Validation - separado (usado em poucos lugares)
          if (id.includes('react-hook-form') || id.includes('zod')) {
            return 'forms-vendor';
          }
          
          // Query & State management
          if (id.includes('@tanstack')) {
            return 'query-vendor';
          }
        }
      },
      // ✅ Tree-shaking agressivo
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      }
    },
    cssCodeSplit: true, // Split CSS por rota para melhor cache
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
    // asyncCssPlugin(), // DESABILITADO - quebra carregamento do CSS completamente
    // swVersionPlugin() - não necessário com generateSW strategy
    // criticalCssPlugin() - desabilitado por causar falha no build
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      strategies: 'generateSW',
      includeAssets: ['favicon.ico', 'hero-truck-real-night.webp', 'apple-touch-icon.png'],
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg,webp,avif}'],
        maximumFileSizeToCacheInBytes: 5000000,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
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
    dedupe: ['react', 'react-dom'],
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
