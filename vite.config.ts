/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const ink = "#16202a";

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; relative base keeps assets working there.
  base: "./",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      // No update UI in Phase 1: a new version installs in the background and takes over on
      // the next launch, so it can never reload the page mid-game.
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
      manifest: {
        name: "Soccer Coach",
        short_name: "Coach",
        description: "Lineups, playing time and positions for youth soccer.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: ink,
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the app shell. Supabase API calls aren't cached by the service worker;
        // offline data comes from IndexedDB.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
