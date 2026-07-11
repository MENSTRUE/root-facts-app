import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'RootFacts - AI Plant/Root Recognition',
        short_name: 'RootFacts',
        description: 'Aplikasi AI untuk mengenali sayuran dari kamera dan memberikan fakta menarik menggunakan TensorFlow.js dan Transformers.js, dapat digunakan secara offline.',
        theme_color: '#10b981',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell plus all local static assets,
        // INCLUDING the TensorFlow.js model (model.json, weights.bin) and
        // its metadata so vegetable detection keeps working offline once
        // the app has been visited online at least once.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg}',
          'model/model.json',
          'model/metadata.json',
          'model/*.bin',
        ],
        // weights.bin (~2.1MB) comfortably fits under this raised limit;
        // the default Workbox limit (2MB) would silently exclude it, so it
        // is explicitly raised here. Set generously above the current
        // model size to tolerate minor model updates.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Transformers.js / Hugging Face Hub model shards + tokenizer
            // files fetched at runtime the first time the generator loads.
            urlPattern: ({ url }) =>
              url.hostname === 'huggingface.co' ||
              url.hostname.endsWith('.huggingface.co') ||
              url.hostname === 'cdn-lfs.huggingface.co' ||
              url.hostname === 'cdn-lfs-us-1.huggingface.co',
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-model-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // ONNX Runtime Web / Transformers.js WASM backend files, when
            // served from a CDN instead of bundled locally.
            urlPattern: ({ request, url }) =>
              request.destination === 'script' &&
              (url.pathname.endsWith('.wasm') || url.pathname.includes('ort-wasm')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-runtime-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Google Fonts stylesheet + font files referenced from index.html.
            urlPattern: ({ url }) =>
              url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3001,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
});
