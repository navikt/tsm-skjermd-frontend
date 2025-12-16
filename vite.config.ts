import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  cacheDir: '/tmp/vite-cache', // NB: viktig ved bruk i read-only systemer
  base: '/', // Endre denne hvis widgeten ligger på /widgets/xxx
  server: {
    port: 3000,        // Dev-server
    host: "0.0.0.0",   // Tillat tilgang utenfra, f.eks. fra Docker
    cors: {
      origin: ["https://tsm-skjermd-frontend.intern.nav.no"],     // Endre dette hvis du trenger strengere CORS-regler
      credentials: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  build: {
    outDir: "dist", // viktig for Dockerfile og server.js
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        iframe: path.resolve(__dirname, 'iframe.html'),
      },
      output: {
        // Bruk standard navngivning hvis du ikke har spesielle grunner til custom dir
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
      },
    },
  },
});