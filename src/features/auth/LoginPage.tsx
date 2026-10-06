import { useState, type FormEvent } from "react";
import { supabase } from "../../data/supabase.ts";
import { formText } from "../../ui/form.ts";
import { Button, PageHeader, TextField, ui } from "../../ui/primitives.tsx";

type Step = { kind: "email" } | { kind: "code"; email: string };

/** Email one-time code: works inside an installed iOS PWA (no link back from Mail). */
export function LoginPage() {
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = formText(new FormData(e.currentTarget), "email");
    setBusy(true);
    setError(null);
    // Only invited coaches can sign in; never create accounts from the app.
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setStep({ kind: "code", email });
  }

  async function verify(e: FormEvent<HTMLFormElement>, email: string) {
    e.preventDefault();
    const token = formText(new FormData(e.currentTarget), "code");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (err) setError(err.message);
    // On success, AuthProvider sees the new session and the app renders.
  }

  return (
    <main>
      <PageHeader title="Soccer Coach" subtitle="Sign in" />
      {step.kind === "email" ? (
        <form className={ui.page} onSubmit={(e) => void sendCode(e)}>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            hint="We'll email you a sign-in code."
          />
          {error && <p className={ui.error}>{error}</p>}
          <Button type="submit" disabled={busy}>
            Send code
          </Button>
        </form>
      ) : (
        <form className={ui.page} onSubmit={(e) => void verify(e, step.email)}>
          <TextField
            label="Code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            hint={`Sent to ${step.email}`}
          />
          {error && <p className={ui.error}>{error}</p>}
          <Button type="submit" disabled={busy}>
            Sign in
          </Button>
          <Button variant="ghost" onClick={() => setStep({ kind: "email" })}>
            Use a different email
          </Button>
        </form>
      )}
    </main>
  );
}
