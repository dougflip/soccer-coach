import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "./database.types.ts";

const env = z
  .object({
    VITE_SUPABASE_URL: z.url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .parse(import.meta.env);

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // We log in with a typed one-time code, never a URL callback.
      detectSessionInUrl: false,
    },
  },
);
