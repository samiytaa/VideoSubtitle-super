import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      "/v1": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      "/ocr": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      "/healthz": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173
  }
});
