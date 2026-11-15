import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'virtual:pwa-register': path.resolve(__dirname, 'src/lib/pwaNoop.ts'),
    },
  },
  build: {
    target: ['es2020', 'chrome87', 'safari14'],
    outDir: 'dist-html',
    emptyOutDir: true,
    copyPublicDir: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
  },
});
