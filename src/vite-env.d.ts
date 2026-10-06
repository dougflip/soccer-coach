/// <reference types="vite/client" />

// Must be an interface: it merges with Vite's own ImportMetaEnv declaration.
// oxlint-disable-next-line typescript/consistent-type-definitions
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
