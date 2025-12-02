import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
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

// Plugin to inject cache version into Service Worker
const swVersionPlugin = () => ({
  name: 'sw-version-plugin',
  writeBundle() {
    const fs = require('fs');
    const path = require('path');
    const swPath = path.resolve(__dirname, 'dist/sw.js');
    
    if (fs.existsSync(swPath)) {
      let content = fs.readFileSync(swPath, 'utf8');
      const buildTime = new Date().toISOString().replace(/[:.]/g, '-');
      content = content.replace(/__BUILD_TIME__/g, buildTime);
      fs.writeFileSync(swPath, content);
      console.log('✅ Service Worker versão atualizada:', buildTime);
    }
  }
});

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
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Simplified to 4 main chunks for better HTTP/2 performance
          // Core React + Router
          if (id.includes('node_modules/react') || id.includes('react-router') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          
          // Supabase - only load when authenticated
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          
          // Charts - only load in dashboards (incluir recharts E todas as libs d3 juntas)
          if (id.includes('recharts') || id.includes('d3-') || id.includes('d3.')) {
            return 'charts-vendor';
          }
          
          // Everything else (UI, forms, icons, query)
          if (id.includes('@radix-ui') || id.includes('@tanstack') || id.includes('lucide-react') || 
              id.includes('react-hook-form') || id.includes('zod')) {
            return 'vendor';
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
    // asyncCssPlugin() removed - was causing FOIT and delaying FCP
    swVersionPlugin(),
    // criticalCssPlugin() - desabilitado por causar falha no build
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg,webp,avif}'],
        maximumFileSizeToCacheInBytes: 5000000,
      },
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
        maximumFileSizeToCacheInBytes: 5000000, // 5MB for larger images
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
              networkTimeoutSeconds: 5, // Fallback to cache after 5s
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
