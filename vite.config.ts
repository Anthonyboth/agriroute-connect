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

// Plugin to extract and inline critical CSS
const criticalCssPlugin = () => ({
  name: 'critical-css-plugin',
  async closeBundle() {
    if (process.env.NODE_ENV === 'production') {
      try {
        console.log('🎨 Extracting critical CSS...');
        await generate({
          inline: true,
          base: 'dist',
          src: 'index.html',
          target: {
            html: 'index.html',
          },
          width: 1920,
          height: 1080,
          extract: true,
          minify: true,
          penthouse: {
            timeout: 60000,
          },
        });
        console.log('✅ Critical CSS extracted and inlined successfully');
      } catch (error) {
        console.warn('⚠️  Critical CSS extraction failed:', error);
        // Don't fail the build if critical CSS extraction fails
      }
    }
  }
});

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
          // Core React - minimal bundle
          if (id.includes('node_modules/react/') && !id.includes('react-dom')) {
            return 'react-core';
          }
          if (id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }
          
          // Supabase - only load when authenticated
          if (id.includes('@supabase/supabase-js') || id.includes('@supabase/')) {
            return 'supabase-vendor';
          }
          
          // Charts - only load in dashboards
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }
          
          // React Query - only load when data fetching needed
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          
          // Radix UI - split by component type
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-alert-dialog')) {
            return 'dialog-vendor';
          }
          if (id.includes('@radix-ui/react-dropdown-menu') || id.includes('@radix-ui/react-menubar')) {
            return 'menu-vendor';
          }
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          
          // Forms - load when form components needed
          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
            return 'form-vendor';
          }
          
          // Lucide icons - defer icon loading
          if (id.includes('lucide-react')) {
            return 'icons-vendor';
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
      }
    },
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    asyncCssPlugin(),
    criticalCssPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
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
}));
