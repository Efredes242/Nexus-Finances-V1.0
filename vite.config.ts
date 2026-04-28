import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      nodePolyfills({
        include: ['stream', 'buffer', 'events', 'util', 'process'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        stream: "stream-browserify",
        buffer: "buffer",
      }
    },
    build: {
      // Separar libs grandes en chunks dedicados para que cambios en código de la app
      // no invaliden el cache del navegador para vendor (recharts, lucide, etc.).
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
            'vendor-xlsx': ['xlsx', 'xlsx-js-style'],
          },
        },
      },
      // Subimos el threshold porque la app tiene varios chunks grandes intencionalmente
      // (charts + xlsx + etc.); el warning puro no aporta señal útil.
      chunkSizeWarningLimit: 800,
    },
  };
});
