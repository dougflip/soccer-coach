import { db } from "../data/db.ts";
import { supabase } from "../data/supabase.ts";
import { Button, PageHeader, ui } from "../ui/primitives.tsx";

/** Full-screen message with a sign-out escape hatch (no team, errors). */
export function Message({ title, body }: { title: string; body: string }) {
  return (
    <main>
      <PageHeader title={title} />
      <div className={ui.page}>
        <p>{body}</p>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

/** Clears local data too, so the next person on this device starts clean. */
export async function signOut(): Promise<void> {
  const pending = await db.outbox.count();
  if (
    pending > 0 &&
    // oxlint-disable-next-line no-alert -- rare, destructive action; a native confirm is fine
    !window.confirm(`${pending} changes haven't synced and will be lost. Sign out?`)
  ) {
    return;
  }
  await supabase.auth.signOut();
  await db.delete();
  window.location.reload();
}
