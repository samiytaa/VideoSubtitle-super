import path from 'path';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export function createViteConfig(mode) {
  const env = loadEnv(mode, '.', '');

  return {
    publicDir: 'img',
    base: './',
    test: {
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      globals: true,
    },
    server: {
      port: 5173,
      host: 'localhost',
      watch: {
        ignored: [
          '**/data/**',
          '**/integrated/web2api/data/**',
          '**/integrated/web2api/logs/**',
        ],
      },
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/v1': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/ocr': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/healthz': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve('.', '.'),
      },
    },
  };
}
