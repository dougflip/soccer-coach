import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { db } from "../data/db.ts";
import { supabase } from "../data/supabase.ts";
import { supabaseBackend } from "../data/sync/backend.ts";
import { SyncEngine, type SyncStatus } from "../data/sync/engine.ts";
import type { TeamId } from "../domain/ids.ts";

const SyncContext = createContext<SyncEngine | null>(null);

export function SyncProvider({ teamId, children }: { teamId: TeamId; children: ReactNode }) {
  const [engine] = useState(() => new SyncEngine(db, supabaseBackend(supabase), teamId));
  useEffect(() => engine.start(), [engine]);
  return <SyncContext value={engine}>{children}</SyncContext>;
}

function useEngine(): SyncEngine {
  const engine = use(SyncContext);
  if (!engine) throw new Error("useSync must be used inside <SyncProvider>");
  return engine;
}

export function useSync(): { status: SyncStatus; syncNow: () => Promise<void> } {
  const engine = useEngine();
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  return { status, syncNow: engine.syncNow };
}
