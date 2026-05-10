import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5176,
    // strictPort removed: graceful shutdown in api-server/src/index.ts ensures
    // ports are always released before re-launch. Keeping strictPort: true here
    // would cause a hard crash on any accidental port collision; without it Vite
    // auto-selects the next free port and stays alive.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
