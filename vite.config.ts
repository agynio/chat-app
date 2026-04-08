import path from 'path';
import { build } from 'esbuild';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';

const gatewayTarget = process.env.VITE_GATEWAY_URL || 'http://gateway:8080';

const swEntry = path.resolve(__dirname, 'src/sw.ts');
const swTsconfig = path.resolve(__dirname, 'tsconfig.sw.json');
const swOutfile = path.resolve(__dirname, 'dist/sw.js');
const swDevOutfile = path.resolve(__dirname, 'public/sw.js');

async function buildServiceWorker(outfile: string) {
  await build({
    entryPoints: [swEntry],
    outfile,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2022'],
    tsconfig: swTsconfig,
  });
}

function serviceWorkerBuildPlugin(): Plugin {
  return {
    name: 'service-worker-build',
    apply: 'build',
    async closeBundle() {
      await buildServiceWorker(swOutfile);
    },
  };
}

function serviceWorkerDevPlugin(): Plugin {
  return {
    name: 'service-worker-dev',
    apply: 'serve',
    configureServer(server) {
      const rebuild = () =>
        buildServiceWorker(swDevOutfile).catch((error) => {
          server.config.logger.error(`[service-worker] ${error instanceof Error ? error.message : error}`);
        });

      void rebuild();
      server.watcher.add(swEntry);
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === swEntry) {
          void rebuild();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    command === 'serve' ? serviceWorkerDevPlugin() : serviceWorkerBuildPlugin(),
  ],
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
}));
