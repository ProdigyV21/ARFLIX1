import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          'player-vendor': ['hls.js', 'dashjs', 'shaka-player'],
          'ui-vendor': ['lucide-react', 'zustand'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Increase from default 500KB
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
  },
  server: {
    port: 5176,
    strictPort: true,
    host: true,
    open: false,
  },
  preview: {
    port: 5176,
    strictPort: true,
    host: true,
  },
});
