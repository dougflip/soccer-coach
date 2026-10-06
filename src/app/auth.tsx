import type { Session } from "@supabase/supabase-js";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../data/supabase.ts";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; session: Session };

const AuthContext = createContext<AuthState>({ status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // Fires immediately with the stored session (works offline), then on every change.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: "signedIn", session } : { status: "signedOut" });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export const useAuth = (): AuthState => use(AuthContext);
