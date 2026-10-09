import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const apiTarget = `http://localhost:${process.env.API_PORT ?? 3001}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Listen on the LAN so a phone can open the site (needed to try AR / scan the QR).
    host: true,
    // Allow tunnel hostnames (cloudflared / ngrok) so the phone can load the site over HTTPS.
    allowedHosts: true,
    // `xfwd` forwards the original host, so QR codes encode the address the browser used.
    proxy: { '/api': { target: apiTarget, xfwd: true } },
  },
});
