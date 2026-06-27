import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDevelopment = mode === 'development';
  const isProduction = mode === 'production';

  return {
    base: '/',
    
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: [
            // Remove prop types in production for smaller bundle
            isProduction && [
              'transform-react-remove-prop-types',
              { removeImport: true }
            ]
          ].filter(Boolean),
          babelrc: false,
          configFile: false,
        },
        // Skip TypeScript errors
        tsconfigRaw: {
          compilerOptions: {
            strict: false,
            skipLibCheck: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            noImplicitAny: false,
          },
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
          lang: 'en',
          dir: 'ltr',
          categories: ['business', 'security', 'productivity'],
          
          // iOS specific
          apple_mobile_web_app_capable: 'yes',
          apple_mobile_web_app_status_bar_style: 'black-translucent',
          
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
          
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
          
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.gridsecurity\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
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
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
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
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
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
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
          
          navigationPreload: false,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
        
        // Disable PWA in development
        devOptions: {
          enabled: false,
          type: 'module',
        },
        
        // Only inject register in production
        injectRegister: isProduction ? 'auto' : false,
        disable: isDevelopment,
      }),
    ],
    
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@components', replacement: path.resolve(__dirname, './src/components') },
        { find: '@features', replacement: path.resolve(__dirname, './src/features') },
        { find: '@utils', replacement: path.resolve(__dirname, './src/lib') },
        { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
        { find: '@stores', replacement: path.resolve(__dirname, './src/stores') },
        { find: '@types', replacement: path.resolve(__dirname, './src/types') },
        { find: '@services', replacement: path.resolve(__dirname, './src/services') },
        { find: '@app', replacement: path.resolve(__dirname, './src/app') },
        { find: '@contexts', replacement: path.resolve(__dirname, './src/contexts') },
        { find: '@lib', replacement: path.resolve(__dirname, './src/lib') },
        { find: '@assets', replacement: path.resolve(__dirname, './src/assets') },
        { find: '@styles', replacement: path.resolve(__dirname, './src/styles') },
      ],
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    
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
      
      watch: {
        usePolling: false,
        interval: 1000,
      },
      
      hmr: {
        overlay: true,
      },
      
      // Only use proxy in development
      proxy: isDevelopment ? {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: 'ws://localhost:5000',
          ws: true,
        },
      } : undefined,
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDevelopment,
      minify: 'terser',
      emptyOutDir: true,
      cssMinify: true,
      target: 'es2020',
      cssCodeSplit: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // React vendor
              if (id.includes('react') || 
                  id.includes('react-dom') || 
                  id.includes('react-router-dom') || 
                  id.includes('react-hook-form')) {
                return 'react-vendor';
              }
              
              // UI vendor
              if (id.includes('lucide-react') || 
                  id.includes('clsx') || 
                  id.includes('tailwind-merge') || 
                  id.includes('framer-motion') ||
                  id.includes('@headlessui') ||
                  id.includes('@radix-ui')) {
                return 'ui-vendor';
              }
              
              // Data vendor
              if (id.includes('@tanstack') || 
                  id.includes('zustand') || 
                  id.includes('@reduxjs')) {
                return 'data-vendor';
              }
              
              // Firebase vendor
              if (id.includes('firebase') || 
                  id.includes('@firebase')) {
                return 'firebase-vendor';
              }
              
              // Chart vendor
              if (id.includes('recharts') || 
                  id.includes('chart.js') || 
                  id.includes('d3-') ||
                  id.includes('victory')) {
                return 'chart-vendor';
              }
              
              // Date vendor
              if (id.includes('date-fns') || 
                  id.includes('dayjs') || 
                  id.includes('moment')) {
                return 'date-vendor';
              }
              
              // Everything else from node_modules
              return 'vendor';
            }
          },
          
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            if (assetInfo.name?.endsWith('.png') || 
                assetInfo.name?.endsWith('.jpg') || 
                assetInfo.name?.endsWith('.jpeg') || 
                assetInfo.name?.endsWith('.svg') || 
                assetInfo.name?.endsWith('.gif') || 
                assetInfo.name?.endsWith('.webp')) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (assetInfo.name?.endsWith('.woff') || 
                assetInfo.name?.endsWith('.woff2') || 
                assetInfo.name?.endsWith('.ttf') || 
                assetInfo.name?.endsWith('.eot')) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
          
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
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
        'framer-motion',
        'react-hook-form',
        '@hookform/resolvers',
      ],
      exclude: [],
      esbuildOptions: {
        target: 'es2020',
        platform: 'browser',
      },
    },
    
    // Environment variables prefix
    envPrefix: ['VITE_', 'FIREBASE_'],
    
    // Cache directory
    cacheDir: '.vite-cache',
    
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_DEV__: isDevelopment,
      __IS_PROD__: isProduction,
    },
  };
});