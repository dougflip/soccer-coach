import { useState, type FormEvent } from "react";
import { supabase } from "../../data/supabase.ts";
import { formText } from "../../ui/form.ts";
import { Button, PageHeader, TextField, ui } from "../../ui/primitives.tsx";

/**
 * Email + password. Coach accounts are created in the Supabase dashboard (sign-ups
 * are disabled), so no email delivery / SMTP is needed. Each phone signs in once.
 */
export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: formText(form, "email"),
      password: formText(form, "password", { trim: false }),
    });
    setBusy(false);
    if (err) setError(err.message);
    // On success, AuthProvider sees the new session and the app renders.
  }

  return (
    <main>
      <PageHeader title="Soccer Coach" subtitle="Sign in" />
      <form className={ui.page} onSubmit={(e) => void signIn(e)}>
        <TextField label="Email" name="email" type="email" autoComplete="username" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && <p className={ui.error}>{error}</p>}
        <Button type="submit" disabled={busy}>
          Sign in
        </Button>
      </form>
    </main>
  );
}
