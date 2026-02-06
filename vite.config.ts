import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '.',
  optimizeDeps: {
    exclude: ['pdf-parse']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-xlsx': ['xlsx'],
          'vendor-icons': ['lucide-react'],
        }
      }
    }
  }
});