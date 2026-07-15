import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const hmrHost = process.env.VITE_HMR_HOST || process.env.HMR_HOST || host;

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port,
    strictPort: true,
    hmr: {
      host: hmrHost,
    },
  },
});
