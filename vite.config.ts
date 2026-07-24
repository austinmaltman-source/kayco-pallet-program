/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // Mirrors api/kayco/[...path].ts (the prod edge function). Key comes
        // from .env.local (KAYCO_API_KEY) and never reaches the client bundle.
        '/api/kayco': {
          target: 'https://kayco-planning-dashboard.clondinski1234.workers.dev',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/kayco/, '/api/v1'),
          headers: {
            Authorization: `Bearer ${env.KAYCO_API_KEY ?? ''}`,
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) PalletForge/1.0',
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      restoreMocks: true,
    },
  };
});
