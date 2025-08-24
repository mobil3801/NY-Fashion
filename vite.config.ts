import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isPreview = mode === 'preview';
  const shouldDisableSourceMaps = isProduction || isPreview;

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
      // Disable React DevTools in production/preview
      devTarget: shouldDisableSourceMaps ? 'esbuild' : 'es2015'
    })],

    build: {
      // Disable source maps completely in production/preview to prevent 404 errors
      sourcemap: !shouldDisableSourceMaps,
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
      // Minification settings
      minify: shouldDisableSourceMaps ? 'esbuild' : false,
      // Remove console logs and debugger statements in production
      esbuild: shouldDisableSourceMaps ? {
        drop: ['console', 'debugger'],
        // Ensure no source map references are left in the build
        sourcemap: false
      } : undefined
    },
    // Define environment variables to disable React DevTools
    define: {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: shouldDisableSourceMaps ? 'undefined' : '__REACT_DEVTOOLS_GLOBAL_HOOK__',
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Disable source map warnings
      'process.env.GENERATE_SOURCEMAP': JSON.stringify(!shouldDisableSourceMaps)
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