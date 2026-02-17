import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 3002,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'copy-content',
      closeBundle() {
        // Copy content folder to dist
        const src = path.resolve(__dirname, 'content');
        const dest = path.resolve(__dirname, 'dist/content');
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
    outDir: 'dist',
  }
});
