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
    devSourcemap: false, // Disable CSS sourcemaps in dev for faster HMR
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ✅ OTIMIZADO v2 - split mais granular para reduzir unused JS
          
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
          
          // ✅ Radix UI split por uso: críticos vs deferrable
          // Críticos: usados na landing page (dialog, popover, tooltip, slot)
          if (id.includes('@radix-ui/react-dialog') || 
              id.includes('@radix-ui/react-popover') ||
              id.includes('@radix-ui/react-tooltip') ||
              id.includes('@radix-ui/react-slot') ||
              id.includes('@radix-ui/react-portal') ||
              id.includes('@radix-ui/react-presence') ||
              id.includes('@radix-ui/react-primitive')) {
            return 'ui-core';
          }
          
          // Forms: select, checkbox, radio, label (defer)
          if (id.includes('@radix-ui/react-select') || 
              id.includes('@radix-ui/react-checkbox') ||
              id.includes('@radix-ui/react-radio-group') ||
              id.includes('@radix-ui/react-label') ||
              id.includes('@radix-ui/react-switch')) {
            return 'ui-forms';
          }
          
          // Navigation: tabs, accordion, collapsible, navigation-menu (defer)
          if (id.includes('@radix-ui/react-tabs') || 
              id.includes('@radix-ui/react-accordion') ||
              id.includes('@radix-ui/react-collapsible') ||
              id.includes('@radix-ui/react-navigation-menu') ||
              id.includes('@radix-ui/react-menubar')) {
            return 'ui-navigation';
          }
          
          // Other UI components (defer)
          if (id.includes('@radix-ui')) {
            return 'ui-extras';
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
    // asyncCssPlugin(), // DESABILITADO - quebra carregamento do CSS completamente
    // swVersionPlugin() - não necessário com generateSW strategy
    // criticalCssPlugin() - desabilitado por causar falha no build
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
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
