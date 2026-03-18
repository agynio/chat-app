import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import { mockApiPlugin } from './vite-plugin-mock-api';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mockApiPlugin()],
  test: {
    exclude: [...configDefaults.exclude, 'test/e2e/**'],
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET || 'http://platform-server:3010',
        changeOrigin: true,
        ws: true,
      },
      '/apiv2': {
        target: process.env.VITE_LLM_GATEWAY_URL || 'http://llm-gateway:8080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
