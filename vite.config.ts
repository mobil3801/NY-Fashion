
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Determine actual environment
  const nodeEnv = env.NODE_ENV || mode || 'production';
  
  console.log('Vite Config:', {
    mode,
    nodeEnv,
    envKeys: Object.keys(env).filter(key => key.startsWith('VITE_'))
  });

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
    define: {
      // Ensure NODE_ENV is available at build time
      'import.meta.env.NODE_ENV': JSON.stringify(nodeEnv),
      'import.meta.env.VITE_NODE_ENV': JSON.stringify(nodeEnv),
      // Add other environment variables as needed
      'process.env.NODE_ENV': JSON.stringify(nodeEnv)
    },
    envPrefix: ['VITE_'],
    // Load environment files
    envDir: './',
    build: {
      // Better error handling in production
      minify: nodeEnv === 'production' ? 'esbuild' : false,
      sourcemap: nodeEnv === 'development',
      // Remove console logs in production
      esbuild: {
        drop: nodeEnv === 'production' ? ['console', 'debugger'] : []
      },
      rollupOptions: {
        output: {
          // Better chunk splitting for production
          manualChunks: (id) => {
            // Vendor chunk
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-ui';
              }
              if (id.includes('date-fns') || id.includes('clsx') || id.includes('lucide')) {
                return 'vendor-utils';
              }
              return 'vendor';
            }
            
            // Debug chunks - only in development
            if (nodeEnv === 'development' && (
              id.includes('debug/') || 
              id.includes('testing/') || 
              id.includes('TestingPage') || 
              id.includes('NetworkDebugPage')
            )) {
              return 'debug';
            }
            
            // Context chunks
            if (id.includes('contexts/')) {
              return 'contexts';
            }
            
            // Page chunks
            if (id.includes('pages/')) {
              return 'pages';
            }
          }
        },
        // Tree shaking configuration
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false
        }
      }
    }
  };
});
