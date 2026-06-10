/// <reference types="vite/client" />

// Build-time constants injected by vite.config.ts `define`. See its
// header comment for what each value is and how it's sourced. Surfaced
// in the UI via @/constants/app and main.ts's version-badge.
declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
declare const __ENGINE_VERSION__: string;
declare const __ENGINE_SHA__: string;

// Supabase credentials for the dndbnb account integration (see .env.local.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
