import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production") {
    let url: URL;
    try { url = new URL(env.VITE_API_BASE_URL || ""); } catch { throw new Error("CONFIG_API_BASE_INVALID: VITE_API_BASE_URL must be an explicit production HTTPS URL."); }
    if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname) || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) throw new Error("CONFIG_API_BASE_INVALID: VITE_API_BASE_URL must be a safe production HTTPS URL.");
  }
  return ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  });
});
