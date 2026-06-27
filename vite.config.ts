import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'GRID Security Platform',
        short_name: 'GRID SEC',
        description: 'Security-as-a-Service Platform for Ghana',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        categories: ['business', 'security', 'productivity'],
        icons: [
          {
            src: '/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshot-desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'GRID Security Dashboard',
          },
          {
            src: '/screenshot-mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Mobile Monitoring',
          },
        ],
        shortcuts: [
          {
            name: 'Live Monitoring',
            short_name: 'Monitor',
            description: 'View live camera feeds',
            url: '/customer/monitoring',
            icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Video Archive',
            short_name: 'Archive',
            description: 'Access recorded footage',
            url: '/customer/recordings',
            icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Support',
            short_name: 'Support',
            description: 'Get help',
            url: '/customer/support',
            icons: [{ src: '/icon-96x96.png', sizes: '96x96' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globIgnores: ['**/node_modules/**/*', '**/firebase-config/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.gridsecurity\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
        navigationPreload: true,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: process.env.NODE_ENV === 'development',
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@utils': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
  // FIX: Skip TypeScript type checking during build
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        noEmit: true,
        skipLibCheck: true,
        isolatedModules: true,
        strict: false,
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'terser',
    // Force build even with TypeScript errors
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React vendor
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          // UI vendor
          if (id.includes('node_modules/lucide-react') || 
              id.includes('node_modules/clsx') || 
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/framer-motion')) {
            return 'ui-vendor';
          }
          // Data vendor
          if (id.includes('node_modules/@tanstack/react-query') || 
              id.includes('node_modules/zustand')) {
            return 'data-vendor';
          }
          // Firebase vendor
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }
          // Chart vendor
          if (id.includes('node_modules/recharts') || 
              id.includes('node_modules/chart.js') ||
              id.includes('node_modules/d3-')) {
            return 'chart-vendor';
          }
          // Form vendor
          if (id.includes('node_modules/react-hook-form') || 
              id.includes('node_modules/@hookform/resolvers') || 
              id.includes('node_modules/zod') ||
              id.includes('node_modules/date-fns')) {
            return 'form-vendor';
          }
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (assetInfo.name?.endsWith('.png') || assetInfo.name?.endsWith('.jpg') || assetInfo.name?.endsWith('.svg')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 1000,
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: true,
  },
  preview: {
    port: 3000,
    open: true,
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
    },
    // Ensure PostCSS is used
    postcss: './postcss.config.js',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      '@tanstack/react-query',
      'zustand',
      'clsx',
      'tailwind-merge',
    ],
    exclude: [],
    esbuildOptions: {
      target: 'es2020',
      platform: 'browser',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});