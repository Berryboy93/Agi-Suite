import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null;
        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/components": path.resolve(__dirname, "src/components/ui"),
      "@/tokens": path.resolve(__dirname, "src/ui/tokens"),
      "@/primitives": path.resolve(__dirname, "src/primitives"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
    },
  },
  server: {
    host: true,
    port: 5176,
    strictPort: false,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
