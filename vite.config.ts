import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Expose server-only secrets (no VITE_ prefix) from .env files to server functions.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  return {
    // nitro builds the server for the host (auto-detects Vercel when deployed there).
    plugins: [tanstackStart(), nitro(), react(), tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
  };
});
