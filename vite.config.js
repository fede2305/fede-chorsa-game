import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/fede-chorsa-game/' : '/',
  server: { host: true, port: 5173 },
});
