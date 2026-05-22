import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import { resolve } from "path";
import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lingui(), babel({ presets: [linguiTransformerBabelPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
