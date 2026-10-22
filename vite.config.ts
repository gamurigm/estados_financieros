import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const mobileEnv = loadEnv(mode, resolve(process.cwd(), 'mobile'), '');
  const apiTarget = process.env.VITE_API_PROXY_TARGET
    ?? mobileEnv.EXPO_PUBLIC_API_BASE_URL
    ?? 'http://127.0.0.1:3001';

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
  };
});
