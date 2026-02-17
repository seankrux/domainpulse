import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          overlay: false  // Disable error overlay completely
        },
        proxy: {
          '/api': {
            target: env.VITE_PROXY_URL || 'http://localhost:3001',
            changeOrigin: true,
          }
        },
        watch: {
          ignored: [
            '**/api/**',
            '**/server/**',
            '**/node_modules/**',
            '**/*.test.ts',
            '**/*.spec.ts'
          ]
        }
      },
      plugins: [react()],
      define: {
        'process.env.PROXY_URL': JSON.stringify(env.VITE_PROXY_URL || 'http://localhost:3001')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              charts: ['recharts'],
              icons: ['lucide-react']
            }
          }
        },
        chunkSizeWarningLimit: 400
      }
    };
});
