
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Determine actual environment
  const nodeEnv = env.NODE_ENV || mode || 'production';
  const isProduction = nodeEnv === 'production';

  // Only log in development
  if (!isProduction) {
    console.log('Vite Config:', {
      mode,
      nodeEnv,
      envKeys: Object.keys(env).filter((key) => key.startsWith('VITE_'))
    });
  }

  return {
    server: {
      host: "::",
      port: 8080
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    build: {
      // Production optimization
      minify: 'terser',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Bundle splitting for optimal loading
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
            charts: ['recharts'],
            query: ['@tanstack/react-query']
          }
        }
      },
      // Remove console logs in production
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    },
    // Production environment variables
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    define: {
      // Ensure NODE_ENV is available at build time
      'import.meta.env.NODE_ENV': JSON.stringify(nodeEnv),
      'import.meta.env.VITE_NODE_ENV': JSON.stringify(nodeEnv),
      // Add other environment variables as needed
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      // Define global constants for better tree-shaking
      __DEV__: JSON.stringify(!isProduction),
      __PROD__: JSON.stringify(isProduction),
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    },
    envPrefix: ['VITE_'],
    // Load environment files
    envDir: './',
    build: {
      // Production optimizations
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
      // Target modern browsers for smaller bundle sizes
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari12'],
      // Remove console logs in production
      esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
        legalComments: 'none',
        pure: isProduction ? ['console.log', 'console.info', 'console.warn'] : []
      },
      // Optimize bundle size
      chunkSizeWarningLimit: 500, // Reduced for better performance
      assetsInlineLimit: 4096, // Inline small assets
      rollupOptions: {
        // Exclude debug modules from production build
        external: isProduction ? [
        'src/pages/debug/NetworkDebugPage',
        'src/pages/TestingPage',
        'src/pages/ComprehensiveTestingPage',
        'src/pages/ErrorMonitoringPage',
        'src/pages/NetworkValidationPage'] :
        [],
        output: {
          // Aggressive chunk splitting for production
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-ui';
              }
              if (id.includes('@tanstack')) {
                return 'vendor-query';
              }
              if (id.includes('date-fns') || id.includes('clsx') || id.includes('lucide')) {
                return 'vendor-utils';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-animation';
              }
              return 'vendor';
            }

            // Skip debug chunks in production
            if (isProduction && (
            id.includes('debug/') ||
            id.includes('testing/') ||
            id.includes('TestingPage') ||
            id.includes('NetworkDebugPage') ||
            id.includes('ErrorMonitoringPage')))
            {
              return undefined; // Let it be included in main chunk or excluded
            }

            // Core application chunks
            if (id.includes('contexts/')) {
              return 'app-contexts';
            }

            if (id.includes('pages/')) {
              // Group pages by functionality
              if (id.includes('auth/')) return 'pages-auth';
              if (id.includes('pos/') || id.includes('POSPage')) return 'pages-pos';
              if (id.includes('inventory/') || id.includes('InventoryPage')) return 'pages-inventory';
              if (id.includes('sales/') || id.includes('SalesPage')) return 'pages-sales';
              return 'pages-core';
            }

            if (id.includes('components/')) {
              // Group components by functionality
              if (id.includes('ui/')) return 'ui-components';
              if (id.includes('layout/')) return 'layout-components';
              if (id.includes('common/')) return 'common-components';
              if (id.includes('pos/')) return 'pos-components';
              if (id.includes('inventory/')) return 'inventory-components';
              return 'app-components';
            }

            if (id.includes('utils/') || id.includes('lib/')) {
              return 'app-utils';
            }
          },
          // Optimize asset naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name!.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `images/[name].[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `styles/[name].[hash][extname]`;
            }
            return `assets/[name].[hash][extname]`;
          },
          chunkFileNames: 'chunks/[name].[hash].js',
          entryFileNames: 'entry/[name].[hash].js'
        },
        // Enhanced tree shaking
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
          preset: 'smallest'
        }
      }
    },
    // Production optimizations
    ...(isProduction && {
      esbuild: {
        drop: ['console', 'debugger'],
        legalComments: 'none',
        minifyIdentifiers: true,
        minifySyntax: true,
        minifyWhitespace: true
      }
    })
  };
});