// `vitest/config` re-exports Vite's defineConfig with the `test` key typed in;
// importing it from `vite` makes `test` an unknown property.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '.',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: false,
    clearMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
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
