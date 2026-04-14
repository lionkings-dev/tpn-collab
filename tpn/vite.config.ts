import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@tpn/contracts"],
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
});
