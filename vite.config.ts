import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import { mockApiPlugin } from './vite-plugin-mock-api';

const gatewayTarget = process.env.VITE_GATEWAY_URL || 'http://gateway:8080';

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
        target: gatewayTarget,
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: gatewayTarget,
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
