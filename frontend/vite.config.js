
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['tackle-erasable-hummus.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:5100',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY || 'http://localhost:5100',
        changeOrigin: true,
      },
    },
  },
});
