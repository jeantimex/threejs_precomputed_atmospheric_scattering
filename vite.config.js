import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base public path when served in production
  base: './',
  
  // Configure the build
  build: {
    // Output directory for the build
    outDir: 'dist',
    
    // Configure the entry point
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  
  // Configure the dev server
  server: {
    open: true, // Automatically open the browser
    port: 3000,
  },
  
  // Configure asset handling
  assetsInclude: ['**/*.dat'], // Ensure .dat files are treated as assets
  
  // Configure public directory (where static assets are stored)
  publicDir: 'public',
});
