import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/v1/auth": {
        target: "http://sdes_auth:3001",
        changeOrigin: true,
      },
      "/cases": {
        target: "http://sdes_case:3003",
        changeOrigin: true,
      },
    },
  },
});
