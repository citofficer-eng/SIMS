import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // Use 3001 explicitly to avoid automatic port shifts
        port: 3001,
        host: '0.0.0.0',
        proxy: {
          // Proxy /api to the XAMPP backend root. Adjust if your XAMPP project is in a different folder.
          '/api': {
            target: 'http://localhost/SIMS4',
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          // Prefer ESM builds for generated dataconnect package to avoid bundling CommonJS require()
          '@dataconnect/generated': path.resolve(__dirname, 'src/dataconnect-generated/esm/index.esm.js'),
          '@dataconnect/generated/react': path.resolve(__dirname, 'src/dataconnect-generated/react/esm/index.esm.js'),
        }
      }
    };
});
