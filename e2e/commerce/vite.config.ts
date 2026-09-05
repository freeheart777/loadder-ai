import { mergeConfig } from "vite";
import baseConfig from "../../vite.config";

const apiTarget = process.env.E2E_API_BASE_URL;

if (!apiTarget) {
  throw new Error("E2E_API_BASE_URL is required for the commerce E2E proxy.");
}

export default mergeConfig(baseConfig, {
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
