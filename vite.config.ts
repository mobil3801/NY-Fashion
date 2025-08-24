
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  // Always use production settings
  const isProduction = true;

  return {
    server: {
      host: "::",
      port: 8080
    },
    preview: {
      host: "::",
      port: 8080
    },
    plugins: [
    react({
      // Always use production settings
      devTarget: 'esbuild'
    })],


    build: {
      // Disable source maps completely
      sourcemap: false,
      // Ensure proper asset handling
      assetsDir: 'assets',
      // Prevent URL encoding issues in asset paths
      rollupOptions: {
        output: {
          // Clean asset naming to prevent URL encoding issues
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js'
        }
      },
      // Always minify
      minify: 'esbuild',
      // Remove console logs and debugger statements in production
      esbuild: {
        drop: ['console', 'debugger'],
        sourcemap: false
      }
    },
    // Force production environment variables
    define: {
      // Disable React DevTools completely
      __REACT_DEVTOOLS_GLOBAL_HOOK__: 'undefined',
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.REACT_APP_NODE_ENV': JSON.stringify('production'),
      'process.env.VITE_NODE_ENV': JSON.stringify('production'),
      // Disable source map warnings
      'process.env.GENERATE_SOURCEMAP': JSON.stringify('false'),
      // Disable React DevTools
      'process.env.REACT_DEVTOOLS_DISABLED': JSON.stringify('true')
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    // Ensure proper base path handling
    base: './',
    // Experimental features for better asset handling
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        // Ensure assets are served with correct paths
        if (hostType === 'js') {
          return { js: `"./${filename}"` };
        } else {
          return { relative: true };
        }
      }
    }
  };
});