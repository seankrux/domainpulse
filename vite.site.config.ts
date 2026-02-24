import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3002,
    host: '0.0.0.0',
    hmr: {
      overlay: false  // Disable error overlay
    },
    watch: {
      ignored: [
        '**/api/**',
        '**/server/**',
        '**/node_modules/**'
      ]
    }
  },
  plugins: [
    react(),
    {
      name: 'copy-content',
      closeBundle() {
        // Copy content folder to dist-site
        const src = path.resolve(__dirname, 'content');
        const dest = path.resolve(__dirname, 'dist-site/content');
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist-site',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 300
  }
});
