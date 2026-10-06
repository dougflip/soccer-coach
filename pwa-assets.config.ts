import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

const grass = "#2f8f4e";

// Run `npm run icons` after changing public/icon.svg; generated PNGs are committed.
// Maskable/Apple icons get padded by the OS, so pad with grass instead of white.
// oxlint-disable-next-line import/no-default-export -- tool requires a default export
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: grass } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: grass } },
  },
  images: ["public/icon.svg"],
});
