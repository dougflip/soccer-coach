/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; relative base keeps assets working there.
  base: "./",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
