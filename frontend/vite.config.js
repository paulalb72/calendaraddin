import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Im Dev-Modus werden /api-Aufrufe an das FastAPI-Backend (Port 8000) geproxyt.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
